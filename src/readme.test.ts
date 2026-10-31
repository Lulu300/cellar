import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** The lines of a compose file that Docker reads, without comments and blank lines. */
const settings = (compose: string) =>
    compose
        .split('\n')
        .map((line) => line.trimEnd())
        .filter((line) => line.trim() !== '' && !line.trim().startsWith('#'));

/** The compose file that the Installation section of README.md tells the reader to write. */
function readmeCompose(): string {
    const readme = readFileSync('README.md', 'utf8');
    const installation = readme.slice(readme.indexOf('\n## Installation\n'));
    const block = installation.match(/```yaml\n([\s\S]*?)\n *```/)?.[1];
    if (!block) throw new Error('No yaml block in the Installation section of README.md');
    const indent = block.match(/^ */)![0].length;
    return block
        .split('\n')
        .map((line) => line.slice(indent))
        .join('\n');
}

// A new user copies the README's compose file, and later compares it with docker-compose.yml to
// update (README-Docker.md, Updating): only `build`, for a copy of the source code, may differ.
describe('the compose file of README.md', () => {
    it('is docker-compose.yml without its build', () => {
        const repository = settings(readFileSync('docker-compose.yml', 'utf8')).filter(
            (line) => line.trim() !== 'build: .'
        );

        expect(settings(readmeCompose())).toEqual(repository);
    });
});
