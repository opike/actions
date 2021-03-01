// const { Toolkit } = require("actions-toolkit");
const core = require("@actions/core");
const github = require("@actions/github");
const mysqlPromise = require('mysql2/promise');

async function run() {
  try {
    core.startGroup("Logging context object");
    console.log(JSON.stringify(github.context, null, "\t"));
    core.endGroup();

    const token = core.getInput("token");
    const commitMessage = core.getInput("commit-message");
    // const eventName = core.getInput("event-name");
    const eventName = github.context.eventName;
    const prId = core.getInput("pull-request-id");
    const actionName = core.getInput("action-name");
    // const title = core.getInput("title");
    // const body = core.getInput("body");
    // const assignees = core.getInput("assignees");

    const octokit = github.getOctokit(token);

    let prIdOutput = '';
    let herokuAppOutput = '';
    let branchNameOutput = '';
    const herokuAppPrefix = 'hipocampo-pr-';

    const event = tools.context.event;

    const dbUser = process.env.DBUSER;
    const dbPassword = process.env.DBPASSWORD;
    const dbHost = process.env.DBHOST;
    const dbName = process.env.DATABASE;

    switch (eventName) {
      // if pull request event, do x
      // BRANCH NAME ==> ${GITHUB_HEAD_REF}
      // PR # ==> github.event.pull_request.number
      // HEROKU APP ==> hipocampo-pr- + PR #
      // if activity == "opened" ==> write into workflows table
      case 'pull_request':
        let pr = tools.context.payload.pull_request;
        branchNameOutput =  pr.head.ref;
        herokuAppOutput = herokuAppPrefix + pr.number;
        prIdOutput = pr.number;

        let insertId = null;
        let status = 'new';
        let herokuAppName = null;
        let readQuery = `SELECT * FROM workflows WHERE branch="${args.branch}"`;

        const connection = await mysqlPromise.createConnection({
          host: dbHost,
          user: dbUser,
          password: dbPassword,
          database: dbName,
          connectTimeout: 60000
        });

        const [readResponse] = await connection.execute(readQuery);

        if (readResponse.length === 0) {
          console.log('Branch name not found, creating new ci entry.');
          const query =
              `INSERT INTO workflows
       (branch, pull_request_id)
       VALUES ("${args.branch}", ${args.pullRequestId})`;

          const [response] = await connection.execute(query);

          insertId = response.insertId;
        } else {
          insertId = readResponse[0].id;
          herokuAppName = readResponse[0].heroku_app;
          // It's possible that we created the db record but failed prior to
          // deploying heroku.
          if (herokuAppName) {
            status = 'existing';
          }
          console.log(`ci id ${insertId} found for branch ${args.branch}`);
        }
        break;
      // if push event, do y
      // PR # ==> extracted from commit message
      // BRANCH NAME ==> do lookup in workflows table based of PR #
      // HEROKU APP ==> do lookup in workflows table based of PR #
      case 'push':
        let begin = message.indexOf('(#') + '(#'.length;
        let end = message.indexOf(')', begin);
        prIdOutput = message.substring(begin, end).trim();
        branchNameOutput = tools.context.ref;
        herokuAppOutput = herokuAppPrefix + prIdOutput;
        break;
      // if workflow dispatch event do z
      //  BRANCH NAME ==> ${GITHUB_REF#refs/heads/}
      // PR # ==> either ${{ github.event.number}} or do a lookup
      // HEROKU APP ==> hipocampo-pr- + PR # (or do a lookup)
      case 'default':
        // Default is workflow dispatch right now
        // TODO: figure out the specific string for workflow dispatch events.
        break;
    }




    // const response = await octokit.issues.create({
    //   ...github.context.repo,
    //   title,
    //   body,
    //   assignees: assignees ? assignees.split("\n") : undefined
    // });

    // TODO: Not sure if we need to output this still.
    core.setOutput("pull-request-id", JSON.stringify(prIdOutput));
    core.setOutput("heroku-app-name", JSON.stringify(herokuAppOutput));
    core.setOutput("branch-name", JSON.stringify(branchNameOutput));
  } catch (error) {
    core.setFailed(error.message);
  }
}


run();