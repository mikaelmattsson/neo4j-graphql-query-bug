import {describe, it, beforeAll, afterAll, expect} from 'vitest';
import {Neo4jGraphQL} from '@neo4j/graphql';
import neo4j from 'neo4j-driver';
import {ApolloServer} from '@apollo/server';
import {typeDefs} from '../src/schema.js';

let driver;
let server;
let originalConsoleLog;
let logMessages = [];

// Sample data to insert into the database
const sampleData = [
  {
    pear: {name: 'Part 1'},
    apple: {},
    banana: {price: 'expensive'},
    grape: {},
    carrot: {},
    potato: {number: 'abc123'}
  },
  {
    pear: {name: 'Part 2'},
    apple: {},
    banana: {price: 'cheap'},
    grape: {},
    carrot: {},
    potato: {number: 'def456'}
  }
];

describe('Neo4j GraphQL Query Bug', () => {
  // Set up Neo4j connection and Apollo Server
  beforeAll(async () => {
    // Capture console.log messages to inspect Cypher queries
    originalConsoleLog = console.log;
    console.log = (...args) => {
      logMessages.push(args.join(' '));
      originalConsoleLog(...args);
    };

    // Wait a bit for Neo4j to be fully ready
    await new Promise(resolve => setTimeout(resolve, 10000));

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
          CREATE (c:Carrot)
          CREATE (po:Potato {number: $potatoNumber})
          CREATE (p)-[:HAS_APPLE]->(a)
          CREATE (a)-[:HAS_BANANA]->(b)
          CREATE (a)-[:HAS_GRAPE]->(g)
          CREATE (g)-[:HAS_CARROT]->(c)
          CREATE (c)-[:HAS_POTATO]->(po)
        `, {
          pearName: data.pear.name,
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
      // debug: true // Enable debug mode to see Cypher queries
    });

    // Create Apollo Server
    server = new ApolloServer({
      schema: await neoSchema.getSchema()
    });
    await server.start();
  }, 60000); // Increase timeout for setup

  afterAll(async () => {
    // Restore original console.log
    console.log = originalConsoleLog;

    if (server) {
      await server.stop();
    }
    if (driver) {
      await driver.close();
    }
  });

  // Test 1: Simple query that should work
  it('should execute a simple query successfully', async () => {
    logMessages = []; // Clear log messages

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
    logMessages = []; // Clear log messages

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

    // Print the logs to see if there are any issues in the generated Cypher query
    const cypherLogs = logMessages.filter(msg => msg.includes('CYPHER'));
    console.log('Generated Cypher Queries:', cypherLogs);

    expect(result.body.kind).toBe('single');
    expect(result.body.singleResult.errors).toBeUndefined();
    expect(result.body.singleResult.data).not.toBeNull();
    expect(result.body.singleResult.data.pears).toHaveLength(0);
  });

  // Test 3: Add another test with a more complicated query structure
  it('should handle a more complex query with multiple nested filters', async () => {
    logMessages = []; // Clear log messages

    const result = await server.executeOperation({
      query: `
        query Parts {
          parts(
            where: {
              AND: [
                {
                  apples_SOME: {
                    banana: {
                      price_CONTAINS: "awdawd"
                    }
                  }
                },
                {
                  apples_SOME: {
                    grape: {
                      carrot: {
                        potato: {
                          number_STARTS_WITH: "abc"
                        }
                      }
                    }
                  }
                }
              ]
            }
          ) {
            name
            apples {
              banana {
                price
              }
              grape {
                carrot {
                  potato {
                    number
                  }
                }
              }
            }
          }
        }
      `
    });

    // Print the logs to see if there are any issues in the generated Cypher query
    const cypherLogs = logMessages.filter(msg => msg.includes('CYPHER'));
    console.log('Generated Cypher Queries for Complex Query:', cypherLogs);

    console.log('No errors found in complex query');
    expect(result.body.singleResult.data).not.toBeNull();
  });
});
