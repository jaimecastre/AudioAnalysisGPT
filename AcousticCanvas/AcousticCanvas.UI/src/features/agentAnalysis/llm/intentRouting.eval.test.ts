import { describe, expect, it } from 'vitest';
import { routeIntent } from './intentRouter';
import { INTENT_ROUTING_FIXTURES } from './intentRouting.fixtures';

describe('intent routing evals', () => {
  it('selects expected tool and normalized args for each fixture', () => {
    const failures: string[] = [];

    for (const fixture of INTENT_ROUTING_FIXTURES) {
      const routed = routeIntent(fixture.user);
      const toolMatches = routed.toolName === fixture.expected.toolName;
      const argsMatch = JSON.stringify(routed.args) === JSON.stringify(fixture.expected.args);

      if (!toolMatches || !argsMatch) {
        failures.push(
          `${fixture.name}: expected ${fixture.expected.toolName} ${JSON.stringify(fixture.expected.args)} but got ${routed.toolName} ${JSON.stringify(routed.args)}`,
        );
      }
    }

    expect(failures).toEqual([]);
  });

  it('keeps unknown fixtures at low confidence', () => {
    const unknownFixtures = INTENT_ROUTING_FIXTURES.filter((fixture) => fixture.expected.toolName === 'unknown');

    for (const fixture of unknownFixtures) {
      const routed = routeIntent(fixture.user);
      expect(routed.toolName).toBe('unknown');
      expect(routed.confidence).toBe('low');
    }
  });
});
