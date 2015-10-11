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


if (Meteor.isClient) {
  Session.set("_isDrag", false);
  Session.set("_itemsLoaded", false);

  Template.dropzone_app.helpers({
    uploads: () => Uploads.find({}, {sort: {createdAt: -1}}),
    empty: () => Uploads.find().count() === 0,
    isDrag: () => Session.get("_isDrag"),
    writeEnabled: () => hasPermission(Meteor.userId()),
    isLoaded: () => Session.get("_itemsLoaded"),
  });
  Template.upload_tmpl.helpers({
    writeEnabled: () => hasPermission(Meteor.userId()),
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
      if (window.confirm("Confirm remove?")) {
        var _id = e.target.getAttribute("docId");
        Meteor.call("deleteFile", _id);
      }
    },
  });

  /* Lazy loading */
  var reCheckLazyLoading = function () {
    setTimeout(() => $(window).trigger("lookup"), 500);
  }
  Template.upload_tmpl.rendered = function () {
    $('img').unveil(100, function() {
      $(this).load(function() {
        this.removeAttribute('width');
        this.removeAttribute('height');
        this.style.opacity = 1;
      });
    });
    reCheckLazyLoading();
  };
  Uploads.find().observe({
    added: reCheckLazyLoading,
    removed: reCheckLazyLoading,
  })

  /* Subscribe */
  Meteor.subscribe("uploads", () => Session.set('_itemsLoaded', true));
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

/**
 * Sandstorm permission checker
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
