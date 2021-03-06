"use strict";

const { ServiceBroker } 	= require("moleculer");
const { MoleculerError } 	= require("moleculer").Errors;
const JaegerService 		= require("../../index");

const THROW_ERR = false;

// Create broker
const broker = new ServiceBroker({
	logger: console,
	logLevel: "debug",
	metrics: true,
	sampleCount: 1
});

// Load Zipkin service
broker.createService({
	mixins: [JaegerService],
	settings: {
		host: "192.168.0.181"
	}
});

const POSTS = [
	{ id: 1, title: "First post", content: "Content of first post", author: 2 },
	{ id: 2, title: "Second post", content: "Content of second post", author: 1 },
	{ id: 3, title: "3rd post", content: "Content of 3rd post", author: 2 },
];

broker.createService({
	name: "posts",
	actions: {
		find: {
			metrics: {
				params: true,
			},
			handler(ctx) {
				const posts = POSTS.map(post => ({...post}));

				return this.Promise.all(posts.map(post => {
					return this.Promise.all([
						ctx.call("users.get", { id: post.author }).then(author => post.author = author),
						ctx.call("votes.count", { postID: post.id }).then(votes => post.votes = votes),
					]);
				})).then(() => posts);
			}
		}
	}
});

const USERS = [
	{ id: 1, name: "John Doe" },
	{ id: 2, name: "Jane Doe" },
];

broker.createService({
	name: "users",
	actions: {
		get: {
			metrics: {
				params: true,
			},
			handler(ctx) {
				return this.Promise.resolve()
					.then(() => {
						const user = USERS.find(user => user.id === ctx.params.id);
						if (user) {
							const res = {...user};
							return ctx.call("friends.count", { userID: user.id })
								.then(friends => res.friends = friends)
								.then(() => res);
						}
					});
			}
		}
	}
});

broker.createService({
	name: "votes",
	actions: {
		count: {
			metrics: {
				params: ["postID"],
				meta: false,
			},
			handler(ctx) {
				return this.Promise.resolve().delay(20).then(() => ctx.params.postID * 3);
			}
		}
	}
});

broker.createService({
	name: "friends",
	actions: {
		count: {
			metrics: {
				params: ["userID"],
				meta: false,
			},
			handler(ctx) {
				if (THROW_ERR && ctx.params.userID == 1)
					throw new MoleculerError("Friends is not found!", 404, "FRIENDS_NOT_FOUND", { userID: ctx.params.userID });

				return this.Promise.resolve().delay(30).then(() => ctx.params.userID * 3);
			}
		}
	}
});

// Start server
broker.start().then(() => {
	broker.repl();

	// Call action
	broker
		.call("posts.find", { limit: 5 }, { meta: { loggedIn: { username: "Adam" } } })
		.then(console.log)
		.catch(console.error);
});
