# @genx/test

Gen-X test framework

## Usage

### testSuite

```
const testSuite = require('@genx/test');
testSuite(async (suite) => { ... }, options);
```

* Options:
    * before: async function run bofore the whole test suite
    * after: async function run after the whole test suite
    * beforeEach: async function run bofore each test suite
    * afterEach: async function run after each test suite
    * serverEntry {string}: server entry file to be instrumented for code coverage
    * verbose {boolean}: verbose output mode
    * skip {boolean}: skip the whole test suite
    * only {boolean}: run this test suite only
    * testDir {string='test'}: test case root directory 

### testCase

```
suite.testCase('test case name', async () => { ... }, options);
```

* Options:
    * data
    * cleanUp
    * skip
    * only

### testCaseFromFixtures

```
suite.testCaseFromFixtures('test case name', async () => { ... }, options);
```

## Helpers inside test case

### startWebServer_

Start a @genx/server instance for code coverage testing.

### startWorker_

Start a @genx/app worker to faciliate testing with features.

### startRestClient_

Start a http client with customzable authencation

### benchmark_

Run benchmark against a group of different methods.

### testStep

Define a test step to show progress in the test report.

### attathObject

Attach an object to the test report.

## Setup test scripts

* Add below scripts into package.json
  * Set NODE_RT=babel to enable directly testing against untranspiled ES code.
  * Set COVER_MODE=1 to enable web server code coverage and replace superagent with supertest.

```
"test:clean": "rm -rf allure-results",
```

```
"test": "npm run test:clean && cross-env NODE_RT=babel mocha --reporter mocha-multi --reporter-options mocha-multi=test/mocha-multi-reporters.json test/*.spec.js",
```

```
"cover": "npm run test:clean && cross-env COVER_MODE=1 NODE_RT=babel nyc --reporter=html --reporter=text -- mocha --reporter progress test/*.spec.js && open ./coverage/index.html",
```

```
"report": "allure generate allure-results --clean -o allure-report && allure open allure-report"
```

## Setup test configs

* test/mocha-multi-reporters.json
```
{    
    "progress": {
        "stdout": "-",        
        "options": {
            "verbose": true
        }
    },
    "allure-mocha": {
        "stdout": "-",
        "options": {
            "resultsDir": "./allure-results"
        }
    }
}
```

* test/conf/test.*.json e.g. test.default.json
See 

## Test spec file sample

```
const testSuite = require("@genx/test");
const Expression = require("@genx/jes");

testSuite(function (suite) {
    suite.testCase("login and get profile", async function () {
        await suite.startRestClient_("<endpointKey>", "<userIdentityKey>", async (app, client) => {
            await suite.testStep_("my-profile", async () => {
                const myProfile = await client.get(["my-profile"]);

                Expression.match(myProfile, {
                    status: "success",
                    response: {
                        id: { $exists: true },
                        agency: { $exists: true },
                        user: { $exists: true },
                    },
                })[0].should.be.ok();
            });
        });
    }, {});
}, { verbose: true });
```

## Local config to run specific cases only or to skip specified cases

```
module.exports = {
    only: [
        // similar to describe.only
        // 
    ],
    skip: [
        // similar to describe.skip
    ]
}
```

Note: another way to do the same thing is to put skip or only in the suite options or test case options passed in through testSuite() and suite.testCase(). 

"skip" and "only" option will override those specified in the config.

## License

  MIT    