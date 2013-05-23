# [Snapbird](http://snapbird.org)

Better Twitter search. Find it at [snapbird.org](http://snapbird.org).

# Running locally

Snapbird requires:

- [Node.js](http://nodejs.org)
- [npm](https://npmjs.org/) (installed with Node)

To run locally, first clone the repository:

```shell
$ git clone git://github.com/remy/snapbird.git
$ cd snapbird
```

Then install dependencies:

```shell
$ npm install
```

There are then a couple of options on how to run Snapbird:

### Without `foreman`

The simplest way is to start Snapbird with `node`, but you must first set up Snapbird's configuration.

You can do this with a `config.json` file, or by passing the required config as environment variables.

With `config.json`, add your Twitter information:

```json
{
  "TWITTER_ID": "abc123xyz789",
  "TWITTER_SECRET": "abc123xyz789abc123xyz789abc123xyz789"
}
```

and start with `node`:

```
$ node app.js
```

Or, with environment variables:

```shell
$ TWITTER_ID=MkLBRXtxgNdpvTV80Irg TWITTER_SECRET=eWFA0tf9lJglrHs1911dXqqnkCyFVzbSwDQIDTBd7s0 node app.js
```

The former method is recommended.

### With foreman

If you have heroku's [toolbelt](https://toolbelt.heroku.com/) installed then you can use foreman to start Snapbird.

To store your configuration, add a file called `.env`:

```
TWITTER_ID=abc123xyz789
TWITTER_SECRET=abc123xyz789abc123xyz789abc123xyz789
```

Then start with foreman:

```
$ foreman start
```

### License

MIT [http://rem.mit-license.org](http://rem.mit-license.org)