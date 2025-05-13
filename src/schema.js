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
}

type Carrot
{
  potato: Potato! # <--- Removing REQUIRED here fixes the issue, but that is not an option for us.
  @relationship(type: "HAS_POTATO", direction: IN)
}

type Potato
{
  number: String!
}
`;

export { typeDefs };
