# Neo4j GraphQL Query Bug Investigation

This repository was created to investigate a potential bug in `@neo4j/graphql` v5.12.2 when using complex nested filters in GraphQL queries. 

## Investigation Results

This project uses a complex GraphQL schema with multiple nested relationships to test the query capabilities of `@neo4j/graphql`. Our tests did not reproduce the reported bug in version 5.12.2 of the library.

The query that was reported to fail is:

```graphql
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
```

In our testing, this query generates the following valid Cypher query:

```cypher
MATCH (this:Pear)
WHERE EXISTS {
    MATCH (this)-[:HAS_APPLE]->(this0:Apple)
    WHERE (single(this1 IN [(this0)-[:HAS_BANANA]->(this1:Banana) WHERE this1.price = $param0 | 1] WHERE true) AND single(this4 IN [(this0)-[:HAS_GRAPE]->(this4:Grape) WHERE single(this3 IN [(this4)-[:HAS_CARROT]->(this3:Carrot) WHERE single(this2 IN [(this3)-[:HAS_POTATO]->(this2:Potato) WHERE this2.number = $param1 | 1] WHERE true) | 1] WHERE true) | 1] WHERE true))
}
RETURN this { .name } AS this
```

Parameters: `{ param0: 'awdawd', param1: 'abc' }`

### Possible Explanations

1. The bug might have been fixed in version 5.12.2
2. The bug might only appear in specific configurations or environments
3. The bug might require a more complex query or data structure than what we've tested

## Project Structure

This project provides a complete test environment for `@neo4j/graphql` with:

- A Neo4j database (v4.4.42-enterprise) running in Docker
- A GraphQL schema with deeply nested relationships
- Apollo Server for executing GraphQL queries
- Vitest for running tests

## Schema

The test schema includes several related entities:

```graphql
type Pear {
  name: String!
  apples: [Apple!]! @relationship(type: "HAS_APPLE", direction: OUT)
}

type Apple {
  banana: Banana @relationship(type: "HAS_BANANA", direction: OUT)
  grape: Grape @relationship(type: "HAS_GRAPE", direction: OUT)
}

type Banana {
  price: String!
}

type Grape {
  carrot: Carrot @relationship(type: "HAS_CARROT", direction: OUT)
}

type Carrot {
  potato: Potato @relationship(type: "HAS_POTATO", direction: OUT)
}

type Potato {
  number: String!
}
```

## Prerequisites

- Node.js
- Docker and Docker Compose

## Setup

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Start the Neo4j database:
   ```
   npm run start:db
   ```

## Running Tests

To run the tests:

```
npm test
```

The tests include:
1. A simple query that fetches all pears
2. The query that was reported to fail, with complex nested filters
3. An even more complex query with multiple nested filters in an AND clause

## Manual Testing with Apollo Explorer

If you want to manually test the queries through a GraphQL playground, you can run:

```
npm run manual
```

This will:
1. Start the Neo4j database (if not already running)
2. Set up the schema and sample data
3. Start an Apollo Server on port 4000
4. Open a browser window with Apollo Explorer

You can then run different variations of the query to try to reproduce the bug.

## Extending the Tests

If you want to try to reproduce the bug in different configurations:

1. Modify the version of @neo4j/graphql in package.json
2. Try different Neo4j versions in docker-compose.yml
3. Add more complex queries or data structures to the tests



