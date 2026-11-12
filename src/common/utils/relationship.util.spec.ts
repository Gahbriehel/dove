import { RelationshipType } from '@prisma/client';
import { getInverseRelationshipType } from './relationship.util';

describe('relationship.util', () => {
  it('inverts PARENT to CHILD and vice-versa', () => {
    expect(getInverseRelationshipType(RelationshipType.PARENT)).toBe(
      RelationshipType.CHILD,
    );
    expect(getInverseRelationshipType(RelationshipType.CHILD)).toBe(
      RelationshipType.PARENT,
    );
  });

  it('keeps SPOUSE, SIBLING and OTHER identical', () => {
    expect(getInverseRelationshipType(RelationshipType.SPOUSE)).toBe(
      RelationshipType.SPOUSE,
    );
    expect(getInverseRelationshipType(RelationshipType.SIBLING)).toBe(
      RelationshipType.SIBLING,
    );
    expect(getInverseRelationshipType(RelationshipType.OTHER)).toBe(
      RelationshipType.OTHER,
    );
  });
});
