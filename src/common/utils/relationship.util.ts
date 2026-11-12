import { RelationshipType } from '@prisma/client';

export function getInverseRelationshipType(
  type: RelationshipType,
): RelationshipType {
  switch (type) {
    case RelationshipType.PARENT:
      return RelationshipType.CHILD;
    case RelationshipType.CHILD:
      return RelationshipType.PARENT;
    case RelationshipType.SPOUSE:
      return RelationshipType.SPOUSE;
    case RelationshipType.SIBLING:
      return RelationshipType.SIBLING;
    case RelationshipType.OTHER:
      return RelationshipType.OTHER;
  }
}
