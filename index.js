#!/usr/bin/env node
'use strict';

const path = require('path');

const simpleGit = require('simple-git');
const { ESLint } = require('eslint');

const git = simpleGit();

const normalizeExtensions = exts => exts.map(e => (!e.startsWith('.') ? `.${e}` : e));

const getStagedFiles = async extensions => {
    const gitStatus = await git.status();
    const normalizedExtensions = normalizeExtensions(extensions);

    return gitStatus.files.reduce((acc, file) => {
        const ext = path.extname(file.path);

        if (file.index !== 'D' && normalizedExtensions.includes(ext)) {
            acc.push(file.path);
        }

        return acc;
    }, []);
};

const preCommitLint = async ({ extensions = ['js', 'jsx', 'ts'] } = {}) => {
    const eslint = new ESLint({ fix: true });

    const staged = await getStagedFiles(extensions);

    let lintResults = await eslint.lintFiles(staged);

    await ESLint.outputFixes(lintResults);

    lintResults = await eslint.lintFiles(staged);

    const errors = lintResults.reduce((acc, r) => {
        if (r.errorCount) {
            acc.push(...r.messages.map(m => JSON.stringify(m)));
        }

        return acc;
    }, []);

    if (errors.length) {
        throw new Error(errors.join('\n'));
    }

    return git.raw(['add', ...staged]);
};

module.exports = preCommitLint;

if (require.main === module) {
    const main = () => {
        return preCommitLint();
    };

    main()
        .then(() => process.exit(0))
        .catch(e => {
            // eslint-disable-next-line no-console
            console.error(e);

            process.exit(1);
        });
}
