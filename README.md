# @genx/test

Gen-X test framework

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

## 

## Test spec file sample

```
const testSuite = require("@genx/test");
const Expression = require("@genx/jes");

testSuite(__filename, function (suite) {
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

## License

  MIT    