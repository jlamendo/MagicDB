It's dead simple to use - I'll stick with code examples.

npm i magicdb

```
var MagicDB = require('./index.js');
var magicDB = new MagicDB('./base'); //Storage Folder - Uses levelDB as a backend.
var db = magicDB.db;
db.testString = 'asdf'; 

// This creates a new vanilla .js object. Stored as JSON.
db.testObj = {'abdscsd':{'asdasds':'asdsad'}}; 

// This will create a new isolated sublevel for the object - all keys are stored as individual k/v pairs within the namespace. 
db.__child('testChild').newAttr = 10005; 
// Once the child is initialized, it can be used just like a normal object.
// Initialization does not persist through restarts in order to save on performance.
db.testChild.newAttrTwo = 10006;
// But no worries! The initialization format will operate just like a JS object as well, even after the first initalization.
db.__child('testChild').newAttrTwo
10006
```

Put and Delete operations are performed asynchronously through a queue. But, because we're dealing with return values, get operations had to be done synchronously, or at least with the appearance of it. This means that there are no callbacks for error detection. To get around this problem, the magicDB object is also an eventEmitter. 

```
magicDB.on('Error', function(data){
	//do some logging, etc.
});
magicDB.on('status', function(data){
	//do some logging, etc.
});
//Enable logging and set an interval. Set to 0 to disable again.
magicDB.emit('config',{statsInterval: 10000});


```

Each instance is also an event emitter accessible through some 'prototype' methods:

```
db.__child('testChild');
db.testChild.__mdbOn('put', function(kv){
	console.log('The key ' + kv.key + ' was added to the database with a value of ' + kv.value);

});
db.testChild.__mdbOn('del', function(kv){
	console.log('The key ' + kv.key + ' was removed from the database.');

})


```

And there are some control methods provided as well:

```
// Stop writes/deletes to the db.
magicDB.emit('sync', 'pause');
//And re-enable:
magicDB.emit('sync', 'resume');

```