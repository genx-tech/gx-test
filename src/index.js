if (process.env.ASYNC_DUMP) {
    require("./asyncDump");
}

const path = require("path");
const { _ } = require("@genx/july");
const { fs } = require("@genx/sys");
const Suite = require("./Suite");

const SPECJS = ".spec.js";
const DOTJS = ".js";

const TEST_OPTS = "test/test.local.js"; 

/**
 * Test body used to define test cases.
 * @callback testSuiteBody
 * @param {Suite} suite - The test suite object
 */

/**
 * Create a test suite.
 * @param {string} [file] - The test spec file name, just use __filename.
 * @param {testSuiteBody} body - To define test cased in this callback.
 * @param {object} [options]
 * @property {function} options.before - Prepare work before all test cases.
 * @property {function} options.after - Cleanup work after all test cases.
 * @property {string} [options.serverEntry="../../src/index.js"] - The entry file of @genx/server instance.
 * @property {boolean} options.verbose - Verbose mode.
 */
function testSuite(file, body, options) {
    if (typeof options === 'undefined') {        
        if (typeof file !== 'string') {
            if (typeof body !== 'undefined') {
                // two arguments
                options = body;
            } 

            body = file;

            const dbgGetCallerFile = require("@genx/july/lib/commonjs/lang/dbgGetCallerFile");
            file = dbgGetCallerFile();
        }
    }

    const {
        before: onBefore,
        after: onAfter,
        beforeEach: onBeforeEachCase,
        afterEach: onAfterEachCase,
        serverEntry,
        verbose,
        skip,
        only,
    } = options == null ? {} : options;

    const suiteName = path.basename(file, file.endsWith(SPECJS) ? SPECJS : DOTJS);
    const testOptsFile = path.resolve(TEST_OPTS);
    let testOpts;

    if (fs.existsSync(testOptsFile)) {
        testOpts = require(testOptsFile);
    }

    const suiteOptions = {
        serverEntry,
        verbose,
        ...(testOpts ? _.pick(testOpts, ["serverEntry", "verbose"]) : {}),
    };

    const suite = new Suite(suiteName, suiteOptions);

    let opt;

    if (only) {
        opt = "only";
    } else if (skip) {
        opt = "skip";
    } else if (testOpts) {
        const only = new Set(testOpts.only);

        if (only.has(suiteName)) {
            opt = "only";
        } else {
            if (!_.isEmpty(testOpts.only)) {
                console.log(`Suite "${suiteName}" skipped.`);
            } else {
                const skip = new Set(testOpts.skip);
                if (skip.has(suiteName)) {
                    opt = "skip";
                    console.log(`Suite "${suiteName}" skipped.`);
                }
            }
        }
    }

    (opt ? describe[opt] : describe)(suiteName, function () {
        before(async () => {
            suite.initAllure();

            if (verbose) {
                console.log("Starting suite:", suiteName);
            }

            if (process.env.COVER_MODE) {
                await suite.startWebServer_();
            }

            if (onBefore) {
                await onBefore();
            }
        });

        after(async () => {
            await suite.stopWebServerIfStarted_();

            if (onAfter) {
                await onAfter();
            }

            console.log();
            if (verbose) {
                console.log("Finished suite:", suiteName);
            }

            if (process.env.ASYNC_DUMP) {
                asyncDump(process.env.ASYNC_DUMP.length > 1 ? process.env.ASYNC_DUMP : null);
            }
        });

        if (onBeforeEachCase) {
            beforeEach(() => onBeforeEachCase(suite));
        }

        if (onAfterEachCase) {
            afterEach(() => onAfterEachCase(suite));
        }

        body(suite);
    });
}

module.exports = testSuite;
