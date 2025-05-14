import {describe, it, beforeAll, afterAll, expect} from 'vitest';
import {Neo4jGraphQL} from '@neo4j/graphql';
import neo4j from 'neo4j-driver';
import {ApolloServer} from '@apollo/server';
import {typeDefs} from '../src/schema.js';

let driver;
let server;

// Sample data to insert into the database
const sampleData = [
  {
    pear: {name: 'Pear 1'},
    apple: {},
    banana: {price: 'expensive'},
    grape: {},
    carrot: {name: 'carrot1'},
    potato: {number: 'abc123'}
  },
  {
    pear: {name: 'Pear 2'},
    apple: {},
    banana: {price: 'cheap'},
    grape: {},
    carrot: {name: "carrot2"},
    potato: {number: 'def456'}
  }
];

describe('Neo4j GraphQL Query Bug', () => {
  // Set up Neo4j connection and Apollo Server
  beforeAll(async () => {

    // Create Neo4j driver connection with proper configuration
    driver = neo4j.driver(
      'bolt://localhost:7687',
      neo4j.auth.basic('neo4j', 'password'),
      {encrypted: false}
    );

    // Verify connection
    try {
      const serverInfo = await driver.verifyConnectivity();
      console.log("Successfully connected to Neo4j:", serverInfo);
    } catch (error) {
      console.error("Failed to connect to Neo4j:", error);
      throw error;
    }

    // Create test data in database
    const session = driver.session();

    try {
      // Clear database
      await session.run('MATCH (n) DETACH DELETE n');

      // Create test data
      for (const data of sampleData) {
        await session.run(`
          CREATE (p:Pear {name: $pearName})
          CREATE (a:Apple)
          CREATE (b:Banana {price: $bananaPrice})
          CREATE (g:Grape)
          CREATE (c:Carrot {name: $carrotName})
          CREATE (po:Potato {number: $potatoNumber})
          CREATE (p)-[:HAS_APPLE]->(a)
          CREATE (a)-[:HAS_BANANA]->(b)
          CREATE (a)-[:HAS_GRAPE]->(g)
          CREATE (g)-[:HAS_CARROT]->(c)
          CREATE (c)-[:HAS_POTATO]->(po)
        `, {
          pearName: data.pear.name,
          carrotName: data.carrot.name,
          bananaPrice: data.banana.price,
          potatoNumber: data.potato.number
        });
      }
    } finally {
      await session.close();
    }

    // Initialize Neo4j GraphQL with debug enabled to see Cypher queries
    const neoSchema = new Neo4jGraphQL({
      typeDefs,
      driver,
      features: {
        unsafeEscapeOptions: {
          disableRelationshipTypeEscaping: true,
          disableNodeLabelEscaping: false,
        },
      },
      debug: true // Enable debug mode to see Cypher queries
    });

    // Create Apollo Server
    server = new ApolloServer({
      schema: await neoSchema.getSchema()
    });

    await server.start();
  }, 60000); // Increase timeout for setup

  afterAll(async () => {
    if (server) {
      await server.stop();
    }
    if (driver) {
      await driver.close();
    }
  });

  // Test 1: Simple query that should work
  it('should execute a simple query successfully', async () => {
    const result = await server.executeOperation({
      query: `
        query {
          pears {
            name
          }
        }
      `
    }, {
      context: {
        cypherParams: {
          jwt: {
            roles: ['downstream']
          },
          roles: ['downstream']
        }
      }
    });

    expect(result.body.kind).toBe('single');
    expect(result.body.singleResult.errors).toBeUndefined();
    expect(result.body.singleResult.data).not.toBeNull();
    expect(result.body.singleResult.data.pears).toHaveLength(2);
  });

  // Test 2: Demonstrate the bug with complex nested filters
  it('should demonstrate the bug with complex nested filters', async () => {

    const result = await server.executeOperation({
      query: `
      query Pears {
        pears(
          where: {
            apples_SOME: {
              banana: {
                price: "awdawd"
              }
              grape: {
                carrot: {
                  potato: {
                    number: "abc"
                  }
                }
              }
            }
          }
        ) {
          name
        }
      }
      `
    });

    expect(result.body.kind).toBe('single');
    expect(result.body.singleResult.errors).toBeUndefined();
    expect(result.body.singleResult.data).not.toBeNull();
    expect(result.body.singleResult.data.pears).toHaveLength(0);
  });


  // Test 2: Demonstrate the bug with complex nested filters
  it('should create node without any issues', async () => {

    const result = await server.executeOperation({
      query: `
        mutation CreateGrapes {
          createGrapes(
            input: [
              {
                carrot: {
                  connect:  {
                     where:  {
                        node:  {
                           name: "carrot1"
                        }
                     }
                  }
                }
              }
            ]
          ) {
            info {
              nodesCreated
            }
          }
        }
      `
    });

    expect(result.body.kind).toBe('single');
    expect(result.body.singleResult.errors).toBeUndefined();
    expect(result.body.singleResult.data).not.toBeNull();
    expect(result.body.singleResult.data.createGrapes.info.nodesCreated).toBe(1);
  });
});
