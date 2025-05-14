const typeDefs = `

type Pear
{
  name: String!
  apples: [Apple!]!
  @relationship(type: "HAS_APPLE", direction: OUT)
}

type Apple
{
  # filter on apple.banana.price
  banana: Banana!
  @relationship(type: "HAS_BANANA", direction: OUT)

  # filter on apple.grape.carrot.potato.number
  grape: Grape!
  @relationship(type: "HAS_GRAPE", direction: OUT)
}

type Banana
{
  price: String!
}

type Grape
{
  carrot: Carrot
  @relationship(type: "HAS_CARROT", direction: OUT)
  
  potatoShortCut: Potato!
  @relationship(
    # (this)-[:HAS_CARROT]->(:Carrot)-[:HAS_POTATO]->(target:Potato)
    type: "HAS_CARROT]->(:Carrot)-[:HAS_POTATO",
    direction: OUT
  )
}

type Carrot
{
  name: String! @unique

  potato: Potato!
  @relationship(type: "HAS_POTATO", direction: OUT)
}

type Potato
{
  number: String!
}
`;

export { typeDefs };
