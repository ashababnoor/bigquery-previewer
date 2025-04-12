import * as assert from 'assert';
import * as sinon from 'sinon';
import { BigQuery } from '@google-cloud/bigquery';
import { performDryRun } from '../extension';
import { describe, it, beforeEach, afterEach } from 'mocha';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
// import * as myExtension from '../../extension';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Sample test', () => {
		assert.strictEqual(-1, [1, 2, 3].indexOf(5));
		assert.strictEqual(-1, [1, 2, 3].indexOf(0));
	});
});

describe('BigQuery Previewer Tests', () => {
    let bigQueryStub: sinon.SinonStub;

    beforeEach(() => {
        bigQueryStub = sinon.stub(BigQuery.prototype, 'createQueryJob');
    });

    afterEach(() => {
        sinon.restore();
    });

    it('should return scanned bytes on successful dry run', async () => {
        bigQueryStub.resolves([{ metadata: { statistics: { totalBytesProcessed: '1048576' } } }]);

        const result = await performDryRun('SELECT * FROM `project.dataset.table`');

        assert.strictEqual(result.scannedBytes, 1048576);
        assert.deepStrictEqual(result.errors, []);
    });

    it('should return errors on failed dry run', async () => {
        bigQueryStub.rejects({ errors: [{ message: 'Syntax error' }] });

        const result = await performDryRun('INVALID QUERY');

        assert.strictEqual(result.scannedBytes, 0);
        assert.deepStrictEqual(result.errors, ['Syntax error']);
    });
});
