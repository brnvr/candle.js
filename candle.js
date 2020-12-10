var candlejs = null || {};

candlejs.sprite = function(spriteSheet, line, nFrames, xOrigin, yOrigin) {
	this.spriteSheet = spriteSheet;
	this.line = line;
	this.nFrames = nFrames;
	this.xOrigin = xOrigin || 0;
	this.yOrigin = yOrigin || 0;
}

candlejs.spriteSheet = function(strip, imageWidth, imageHeight, xSep, ySep, xOffset, yOffset) {
	this.strip = strip;
	this.imageWidth = imageWidth;
	this.imageHeight = imageHeight;
	this.xSep = xSep || 0;
	this.ySep = ySep || 0;
	this.xOffset = xOffset || 0;
	this.yOffset = yOffset || 0;
}

candlejs.room = function(width, height) {
	this.width = width;
	this.height = height;
	this.actorList = [];
	this.newActors = [];
	this.activationSchedule = [];
	this.actorTree = {Object: {actors: [], childs: {}}};
	this.drawList = [];

	this.addActor = function(actor) {
		let chain, currPrototype, node;

		currPrototype = actor.__proto__.constructor;
		chain = [currPrototype.name];

		if (actor.__active__ == undefined) {
			actor.__active__ = true;
		}

		while (currPrototype != Object) {
			currPrototype = currPrototype.prototype.__proto__.constructor;
			chain.unshift(currPrototype.name);
		}

		node = this.actorTree.Object;

		for (i = 0; i < chain.length; i++)  {
			if (i == chain.length-1) {
				node.actors.push(actor);
			} else {
				if (node.childs[chain[i+1]] == undefined) {
					node.childs[chain[i+1]] = {actors: [], childs: {}};

				}

				node = node.childs[chain[i+1]];
			}
		}

		this.newActors.push(actor);
	}

	this.addActors = function(actors) {
		for (actor of actors) {
			this.addActor(actor);
		}
	}

	this.activateActor = function(actor) {
		if (!actor.__active__) {
			this.activationSchedule.push(function(currActor, functIndex) {
				if (currActor == actor) {
					actor.__active__ = true;
					cthis.activationSchedule.splice(functIndex, 1);
				}
			});
		}
	}

	this.deactivateActor = function(actor) {
		if (actor.__active__) {
			this.activationSchedule.push(function(currActor, functIndex) {
				if (currActor == actor) {
					actor.__active__ = false;
					this.activationSchedule.splice(functIndex, 1);
				}
			});
		}
	}

	this.activateActors = function(actorClass) {
		this.activationSchedule.push(function(currActor) {
			if (!currActor.__active__) {
				if (currActor instanceof actorClass) {
					currActor.__active__ = true;
				}
			}
		});
	}

	this.deactivateActors = function(actorClass) {
		this.activationSchedule.push(function(currActor) {
			if (currActor.__active__) {
				if (currActor instanceof actorClass) {
					currActor.__active__ = false;
				}
			}
		});
	}

	this.activateActorsArea = function(boundingBox) {
		this.activationSchedule.push(function(currActor) {
			if (!currActor.__active__) {
				if (currActor.position != undefined) {
					if (candlejs.boxCollision(boundingBox, currActor, {x: boundingBox.x1, y: boundingBox.y1})) {
						currActor.__active__ = true;
					}
				}
			}
		});
	}

	this.deactivateActorsArea = function(boundingBox) {
		this.activationSchedule.push(function(currActor) {
			if (currActor.__active__) {
				if (currActor.position != undefined) {
					if (candlejs.boxCollision(boundingBox,currActor, {x: boundingBox.x1, y: boundingBox.y1})) {
						currActor.__active__ = false;
					}
				}
			}
		});
	}

	this.searchActorTree = function(actorClass) {
		let chain, currPrototype, node;

		currPrototype = actorClass.prototype.constructor;
		chain = [currPrototype.name];

		while (currPrototype != Object) {
			currPrototype = currPrototype.prototype.__proto__.constructor;
			chain.unshift(currPrototype.name);
		}

		node = this.actorTree.Object;

		for (i = 0; i < chain.length-1; i++)  {
			node = node.childs[chain[i+1]];
		}

		return node;
	}
}

candlejs.setRoom = function(room) {
	candlejs.nextRoom = room;
}

candlejs.start = function(canvas, room) {
	let ctx = canvas.getContext("2d");
	let id = requestAnimationFrame(callback);

	candlejs.currentRoom = room;

	canvas.addEventListener("contextmenu", function(event) {
		event.preventDefault();
		event.stopPropagation();
	});

	function callback() {
		room.newActors.forEach(function(actor) {
			if (actor.create != undefined) {
				actor.create(canvas, ctx);
			}
		});

		room.actorList.forEach(function(actor) {
			room.activationSchedule.forEach(function(funct, functIndex) {
				funct(actor, functIndex);
			});

			if (actor.__active__) {
				if (actor.step != undefined) {
					actor.step(canvas, ctx);
				}

				if (actor.spriteIndex != undefined) {
					if (actor.imageIndex == undefined) actor.imageIndex = 0;
					if (actor.imageSpeed == undefined) actor.imageSpeed = 1;

					candlejs.drawSprite(ctx, actor.spriteIndex, actor.position, actor.imageIndex, actor.depth);

					actor.imageIndex += actor.imageSpeed;
					actor.imageIndex %= actor.spriteIndex.nFrames;
				}

				if (actor.physicsEnabled) {
					if (actor.__velocity__ != undefined) {
						actor.__realPosition__ = candlejs.vector.sum(actor.__velocity__, actor.__realPosition__);
						actor.position = {x: Math.round(actor.__realPosition__.x), y: Math.round(actor.__realPosition__.y)};
					}
				}

				if (actor.__alarms__ != undefined) {
					let entries = Object.entries(actor.__alarms__);

					entries.forEach(function(entry) {
						let alarm, id;

						id = entry[0];
						alarm = entry[1];

						if (alarm.time == 0) {
							alarm.work.call(actor);
							delete actor.__alarms__[id];
						} else {
							alarm.time--;
						}
					});
				}
			}
		});

		room.activationSchedule = [];

		let follow = candlejs.camera.follow

		if (follow.actor != undefined) {
			if (follow.actor.position.x > follow.limit.left) {
				if (follow.actor.position.x <= candlejs.camera.position.x+follow.limit.left) {
					candlejs.camera.position.x = follow.actor.position.x - follow.limit.left;
				}
			} else {
				candlejs.camera.position.x = 0;
			}

			if (follow.actor.position.x < candlejs.currentRoom.width - follow.limit.right) {
				if (follow.actor.position.x >= candlejs.camera.position.x+canvas.width+follow.limit.left) {
					candlejs.camera.position.x = follow.actor.position.x - (canvas.width-follow.limit.right);
				}
			} else {
				candlejs.camera.position.x = candlejs.currentRoom.width - canvas.width;
			}


			if (follow.actor.position.y > follow.limit.top) {
				if (follow.actor.position.y <= candlejs.camera.position.y+follow.limit.top) {
					candlejs.camera.position.y = follow.actor.position.y - follow.limit.top;
				}
			} else {
				candlejs.camera.position.y = 0;
			}

			if (follow.actor.position.y < candlejs.currentRoom.height - follow.limit.bottom) {
				if (follow.actor.position.y >= candlejs.camera.position.y+canvas.height+follow.limit.bottom) {
					candlejs.camera.position.y = follow.actor.position.y - (canvas.height-follow.limit.bottom);
				}
			} else {
				candlejs.camera.position.y = candlejs.currentRoom.width - canvas.height;
			}
		}

		ctx.clearRect(0, 0, canvas.width, canvas.height);

		candlejs.currentRoom.drawList.forEach(function(drawOrder) {
			drawOrder[0]();
		});

		candlejs.currentRoom.drawList = [];

		candlejs.keyboard.keysPressed.forEach(function(code) {
			if (candlejs.keyboard.keysDown[code] == candlejs.inputState.pressed) {
				candlejs.keyboard.keysDown[code] = candlejs.inputState.onhold;
			}
		});
		
		candlejs.keyboard.keysReleased.forEach(function(code) {
			if (candlejs.keyboard.keysDown[code] == candlejs.inputState.released) {
				candlejs.keyboard.keysDown[code] = candlejs.inputState.unpressed;
			}
		});

		candlejs.keyboard.keysPressed = [];
		candlejs.keyboard.keysReleased = [];


		candlejs.mouse.buttonsPressed.forEach(function(button) {
			if (candlejs.mouse.buttonsDown[button] == candlejs.inputState.pressed) {
				candlejs.mouse.buttonsDown[button] = candlejs.inputState.onhold;
			}
		});

		candlejs.mouse.buttonsReleased.forEach(function(button) {
			if (candlejs.mouse.buttonsDown[button] == candlejs.inputState.released) {
				candlejs.mouse.buttonsDown[button] = candlejs.inputState.unpressed;
			}
		});

		candlejs.mouse.buttonsPressed = [];
		candlejs.mouse.buttonsReleased = [];

		room.actorList = room.actorList.concat(room.newActors);
		room.newActors = [];

		if (candlejs.nextRoom != undefined) {
			candlejs.currentRoom = candlejs.nextRoom;
		}

		requestAnimationFrame(callback);
	}

	return id;
}

candlejs.stop = function(id) {
	clearInterval(id);
}

candlejs.drawSprite = function(ctx, spriteIndex, position, imageIndex, depth) {
	imageIndex = Math.floor(imageIndex % spriteIndex.nFrames);

	let funct = function() {
		ctx.drawImage(	spriteIndex.spriteSheet.strip,
						imageIndex*spriteIndex.spriteSheet.imageWidth,
						spriteIndex.line*spriteIndex.spriteSheet.imageHeight,
						spriteIndex.spriteSheet.imageWidth,
						spriteIndex.spriteSheet.imageHeight,
						position.x-spriteIndex.xOrigin-candlejs.camera.position.x,
						position.y-spriteIndex.yOrigin-candlejs.camera.position.y,
						spriteIndex.spriteSheet.imageWidth,
						spriteIndex.spriteSheet.imageHeight);
	}

	let drawOrder = [funct, depth];
	let iPos, fPos, sel;

	iPos = 0;
	fPos = candlejs.currentRoom.drawList.length-1;

	if (fPos < 0) {
		candlejs.currentRoom.drawList.push(drawOrder);
		return 0;
	}

	if (depth < candlejs.currentRoom.drawList[0][1]) {
		candlejs.currentRoom.drawList.push(drawOrder);
		return fPos+1;
	}

	if (depth > candlejs.currentRoom.drawList[fPos][1]) {
		candlejs.currentRoom.drawList.unshift(drawOrder);
		return 0;
	}

	while (fPos - iPos > 1) {
		sel = iPos + ((fPos-iPos) >>> 1);

		if (depth < candlejs.currentRoom.drawList[sel][1]) {
			iPos = sel;
		} else {
			fPos = sel;
		}
	}

	candlejs.currentRoom.drawList.splice(fPos, 0, drawOrder);
	return sel;
}

candlejs.keyboard = {
	activate: function() {
		window.addEventListener("keydown", function(event) {
			if (candlejs.keyboard.keysDown[event.code] != candlejs.inputState.pressed &&
				candlejs.keyboard.keysDown[event.code] != candlejs.inputState.onhold) {
				candlejs.keyboard.keysPressed.push(event.code);
				candlejs.keyboard.keysDown[event.code] = candlejs.inputState.pressed;
			}
		});
		
		window.addEventListener("keyup", function(event) {
			if (candlejs.keyboard.keysDown[event.code] != candlejs.inputState.unpressed &&
				candlejs.keyboard.keysDown[event.code] != candlejs.inputState.released) {
				candlejs.keyboard.keysReleased.push(event.code);
				candlejs.keyboard.keysDown[event.code] = candlejs.inputState.released;
			}
		});
	},

	keyDown: function(code) {
		if (this.keysDown[code] == undefined) {
			return false;
		}

		return this.keysDown[code] == candlejs.inputState.pressed ||
			   this.keysDown[code] == candlejs.inputState.onhold;
	},

	keyPress: function(code) {
		if (this.keysDown[code] == undefined) {
			return false;
		}

		return this.keysDown[code] == candlejs.inputState.pressed;
	},

	keyRelease: function(code) {
		if (this.keysDown[code] == undefined) {
			return false;
		}

		return this.keysDown[code] == candlejs.inputState.released;
	},

	keysDown: {},
	keysPressed: [],
	keysReleased: []
}

candlejs.mouse = {
	activate: function(canvas) {
		canvas.addEventListener("mousedown", function(event) {
			if (candlejs.mouse.buttonsDown[event.button] != candlejs.inputState.pressed &&
				candlejs.mouse.buttonsDown[event.button] != candlejs.inputState.onhold) {
				candlejs.mouse.buttonsPressed.push(event.button);
				candlejs.mouse.buttonsDown[event.button] = candlejs.inputState.pressed;
			}
		});

		canvas.addEventListener("mouseup", function(event) {
			if (candlejs.mouse.buttonsDown[event.button] != candlejs.inputState.unpressed &&
				candlejs.mouse.buttonsDown[event.button] != candlejs.inputState.released) {
				candlejs.mouse.buttonsReleased.push(event.button);
				candlejs.mouse.buttonsDown[event.button] = candlejs.inputState.released;
			}
		});

		canvas.addEventListener("mousemove", function(event) {
			let rect = canvas.getBoundingClientRect();

			candlejs.mouse.position.x = (event.clientX - rect.left)*candlejs.mouse.canvasToMouseProportion.x;
			candlejs.mouse.position.y = (event.clientY - rect.top)*candlejs.mouse.canvasToMouseProportion.y;
		});
	},

	buttonPress: function(code) {
		if (this.buttonsDown[code] == undefined) {
			return false;
		}

		return this.buttonsDown[code] == candlejs.inputState.pressed;
	},

	buttonRelease: function(code) {
		return this.buttonsDown[code] == candlejs.inputState.released;
	},

	buttonDown: function(code) {
		if (this.buttonsDown[code] == undefined) {
			return false;
		}

		return this.buttonsDown[code] == candlejs.inputState.pressed ||
			   this.buttonsDown[code] == candlejs.inputState.onhold;
	},

	getPosition: function() {
		return Object.create(this.position);
	},

	buttons: {
		left: 0,
		middle: 1,
		right: 2
	},

	position: {
		x: undefined,
		y: undefined
	},

	buttonsDown: [],
	buttonsPressed: [],
	buttonsReleased: []
	canvasToMouseProportion = {x: 1, y: 1};
}

candlejs.inputState = {
	unpressed: 0,
	pressed: 1,
	onhold: 2,
	released: 3
}

candlejs.vector = {
	pointMakeVector: function(point1, point2) {
		let xDist, yDist;

		xDist = point2.x - point1.x;
		yDist = point2.y - point1.y;

		return {x: xDist, y: yDist};
	},

	length: function(vector) {
		return Math.sqrt(vector.x*vector.x + vector.y*vector.y);
	},

	direction: function(vector) {
		return Math.atan2(-vector.y, vector.x);
	},

	sum: function(vector1, vector2) {
		let x, y;

		x = vector1.x+vector2.x;
		y = vector1.y+vector2.y;

		return {x, y};
	},

	dotProduct: function(vector, scalar) {
		let x, y;

		x = vector.x*scalar;
		y = vector.y*scalar;

		return {x, y};
	},

	decompose: function(length, direction) {
		let x, y;

		x = Math.cos(direction)*length;
		y = -Math.sin(direction)*length;

		return {x, y};
	}
}

candlejs.actor = {
	move: function(actor, speed, direction) {
		if (actor.__realPosition__ == undefined ||
			Math.abs(actor.__realPosition__.x-actor.position.x>1) ||
			Math.abs(actor.__realPosition__.y-actor.position.y>1)) {
			actor.__realPosition__ = Object.create(actor.position);
		}

		var decSpeed, newX, newY;

		decSpeed = candlejs.vector.decompose(speed, direction);

		newX = actor.__realPosition__.x+decSpeed.x;
		newY = actor.__realPosition__.y+decSpeed.y;

		actor.__realPosition__ = {x: newX, y: newY};
		actor.position = {x: Math.round(newX), y: Math.round(newY)};
	},

	moveTowardsPoint: function(actor, position, speed) {
		if (speed <= 0) throw "'speed' must be a positive number";

		let vector, vLength, factor, newX, newY;

		if (actor.__realPosition__ == undefined ||
			Math.abs(actor.__realPosition__.x-actor.position.x>1) ||
			Math.abs(actor.__realPosition__.y-actor.position.y>1)) {
			actor.__realPosition__ = Object.create(actor.position);
		}

		vector = candlejs.vector.pointMakeVector(actor.__realPosition__, position);
		vLength = candlejs.vector.length(vector);


		if (vLength <= speed) {
			actor.position = {x: Math.round(position.x), y: Math.round(position.y)};

			return true;
		}

		factor = speed/vLength;

		newX = actor.__realPosition__.x + factor*vector.x;
		newY = actor.__realPosition__.y + factor*vector.y;
		
		actor.__realPosition__ = {x: newX, y: newY}
		actor.position = {x: Math.round(newX), y: Math.round(newY)};

		return false;
	},

	applyAcceleration: function(actor, acceleration) {
		if (actor.__velocity__ == undefined) {
			actor.__velocity__ = {x: 0, y: 0};

		}

		if (actor.__realPosition__ == undefined ||
			Math.abs(actor.__realPosition__.x-actor.position.x>1) ||
			Math.abs(actor.__realPosition__.y-actor.position.y>1)) {
			actor.__realPosition__ = Object.create(actor.position);
		}

		acceleration = candlejs.vector.dotProduct(acceleration, candlejs.pixelsToMeter/3600);
		actor.__velocity__ = candlejs.vector.sum(actor.__velocity__, acceleration);
	},

	applyAccelerationDirection: function(actor, direction, scalarAcceleration) {
		if (actor.__velocity__ == undefined) {
			actor.__velocity__ = {x: 0, y: 0};

		}

		if (actor.__realPosition__ == undefined ||
			Math.abs(actor.__realPosition__.x-actor.position.x>1) ||
			Math.abs(actor.__realPosition__.y-actor.position.y>1)) {
			actor.__realPosition__ = Object.create(actor.position);
		}

		acceleration = candlejs.vector.decompose(scalarAcceleration, direction);
		acceleration = candlejs.vector.dotProduct(acceleration, candlejs.pixelsToMeter/3600);
		actor.__velocity__ = candlejs.vector.sum(actor.__velocity__, acceleration);
	},

	startAlarm: function(actor, id, time, work) {
		if (actor.__alarms__ == undefined) {
			actor.__alarms__ = {};
		}

		actor.__alarms__[id] = {time: time, work: work};
	},

	isAlarmActive: function(actor, id) {
		if (actor.__alarms__ == undefined) return false;

		return actor.__alarms__[id] != undefined;
	},

	collision: function(actor, collisorClass, position) {
		if (actor.mask == undefined) {
			return false;
		}

		return candlejs.boxCollision(actor.mask, collisorClass, position);
	},
}

candlejs.boxCollision = function(boundingBox, collisorClass, position) {
	let collides = false;

	function checkCollision(collisor) {
		if (collisor == actor) {
			return;
		}

		if (collisor.mask == undefined) {
			return;
		}

		if (position.x+boundingBox.x1 <= collisor.position.x+collisor.mask.x2 &&
			collisor.position.x+collisor.mask.x1 <= position.x+boundingBox.x2 &&
			position.y+boundingBox.y1 <= collisor.position.y+collisor.mask.y2 &&
			collisor.position.y+collisor.mask.y1 <= position.y+boundingBox.y2) {

			collides = true;
			return;
		}
	}

	if (typeof collisorClass == "function") {
		node = candlejs.currentRoom.searchActorTree(collisorClass);

		function nodeCheckCollision(node) {
			for (collisor of node.actors) {
				checkCollision(collisor);
			}

			for (child of Object.entries(node.childs)) {
				nodeCheckCollision(child);
			}
		}

		nodeCheckCollision(node);
	} else {
		checkCollision(collisorClass);
	}

	return collides;
}

candlejs.pointMeeting = function(collisorClass, position) {
	let chain, currPrototype, node;

	currPrototype = collisorClass.prototype.constructor;
	chain = [currPrototype.name];

	while (currPrototype != Object) {
		currPrototype = currPrototype.prototype.__proto__.constructor;
		chain.unshift(currPrototype.name);
	}

	node = currentRoom.actorTree.Object;

	for (i = 0; i < chain.length-1; i++)  {
		node = node.childs[chain[i+1]];
	}

	let collides = false;

	function checkCollision(node) {
		for (collisor of node.actors) {
			if (collisor.mask == undefined) {
				return;
			}

			if (position.x <= collisor.position.x+collisor.mask.x2 &&
				collisor.position.x+collisor.mask.x1 <= position.x &&
				position.y <= collisor.position.y+collisor.mask.y2 &&
				collisor.position.y+collisor.mask.y1 <= position.y) {

				collides = true;
				return;
			}
		}

		for (child of Object.entries(node.childs)) {
			checkCollision(child);
		}
	}

	checkCollision(node);

	return collides;
}

candlejs.scaleCanvas = function(canvas, xScale, yScale, crispy = false) {
	if (crispy) {
		canvas.setAttribute("style",
		"image-rendering:-moz-crisp-edges;" +
		"image-rendering:-webkit-crisp-edges;" +
		"image-rendering:pixelated;image-rendering: crisp-edges;")
	}

	canvas.style.width = (canvas.width*xScale).toString() + "px";
	canvas.style.height = (canvas.height*yScale).toString() + "px";
	candlejs.mouse.canvasToMouseProportion = {x: 1/xScale, y: 1/yScale};
}

candlejs.camera = {position: {x: 0, y: 0}, follow: {actor: undefined, limit: {left: 0, right: 0, top: 0, bottom: 0}}};
candlejs.pixelsToMeter = 32;
