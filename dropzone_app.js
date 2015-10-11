class UploadModel {
  constructor (doc) {
    _.extend(this, doc);
  }
  isImage () {
    return this.type.indexOf('image') != -1;
  }
}
var Uploads = new Mongo.Collection("Uploads", {
  transform: (doc) => new UploadModel(doc),
});

/**
 * Check if user has sandstorm permissions to edit the document
 * @param {String} userId
 */
var hasPermission = function (userId) {
  var result;
  try {
    var user = Meteor.users.findOne(userId);
    var p = user.services.sandstorm.permissions;
    result = p.indexOf('modify') !== -1 || p.indexOf('owner') !== -1;
  } catch (err) {
    result = false;
  }
  return result;
}

if (Meteor.isClient) {
  Session.set("_isDrag", false);

  Template.dropzone_app.helpers({
    uploads: () => Uploads.find({}, {sort: {createdAt: -1}}),
    empty: () => Uploads.find().count() === 0,
    isDrag: () => Session.get("_isDrag"),
    writeEnabled: () => hasPermission(Meteor.userId()),
  });
  Template.upload_tmpl.helpers({
    writeEnabled: () => hasPermission(Meteor.userId()),
    style: () => {
      var count = Uploads.find().count();
      console.log(count);
      if (count <= 1) {
        return "width: 96%; height: 96%;";
      } else if (count == 2) {
        var amount = String(92.0 / count) + "vw";
        return `width: ${amount}; height:${amount};`
      } else {
        var amount = "500px";
        return `width:${amount}; max-width: ${amount}; height: ${amount};`
      }
    },
  });

  Template.body.events({
    'drag': (e, t) => Session.set("_isDrag", true),
    'dragstart': (e, t) => Session.set("_isDrag", true),
    'dragend': (e, t) => Session.set("_isDrag", false),
    'dragover': (e, t) => Session.set("_isDrag", true),
    'dragenter': (e, t) => Session.set("_isDrag", true),
    'dragleave': (e, t) => Session.set("_isDrag", false),
    'drop': (e, t) => Session.set("_isDrag", false),
  });

  Template.upload_tmpl.events({
    'click .deleteButton': (e, t) => {
      if (window.confirm("Are you sure you want to delete?")) {
        var _id = e.target.getAttribute("docId");
        Meteor.call("deleteFile", _id);
      }
    },
  });

  Meteor.subscribe("uploads");
  Meteor.subscribe("yourself");
}

if (Meteor.isServer) {
  Meteor.startup(function () {
    UploadServer.init({
      tmpDir: process.env.PWD + '/uploads/tmp',
      uploadDir: process.env.PWD + '/uploads/',
      checkCreateDirectories: true,
      finished: function(fileInfo, formFields) {
        _.extend(fileInfo, {
          createdAt: new Date(),
          text: "",
          owner: this.userId || null,
        });
        console.log(this.userId);
        console.log(fileInfo);
        Uploads.insert(fileInfo);
      },
      cacheTime: 100,
    });
  });

  /* Publish */
  Meteor.publish("uploads", () => Uploads.find());

  // Include the extra fields, or else they won't be on the client.
  Meteor.publish("yourself", function () {
    if ( ! this.userId) {
      return [];
    } else {
      return Meteor.users.find(this.userId, {fields: {"services.sandstorm": 1}});
    }
  });


  /* Permissions */
  Meteor.users.allow({
    insert: (userId, doc) => false,
    update: (userId, doc) => false,
    remove: (userId, doc) => false,
  });
  Uploads.allow({
    insert: (userId, doc) => hasPermission(userId),
    update: (userId, doc) => hasPermission(userId),
    remove: (userId, doc) => hasPermission(userId),
  });
}

Meteor.methods({
  'deleteFile': function (_id) {
    if ( ! _id instanceof String) {
      throw new Meteor.Error(404, 'Invalid id argument');
    }
    var upload = Uploads.findOne(_id);
    if (upload == null) {
      throw new Meteor.Error(404, 'Upload not found'); // maybe some other code
    }
    Uploads.remove(_id);
    if (Meteor.isServer) {
      UploadServer.delete(upload.path);
    }
  }
});
