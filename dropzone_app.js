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

  Template.dropzone_app.helpers({
    uploads: () => Uploads.find({}, {sort: {createdAt: -1}}),
    empty: () => Uploads.find().count === 0,
    isDrag: () => Session.get("_isDrag"),
  });

  console.log(UI);
  UI.body.events({
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
      var _id = e.target.getAttribute("docId");
      Meteor.call("deleteFile", _id);
    },
  });
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
          //owner: Meteor.userId(),
          //username: Meteor.user().username
        })
        console.log(fileInfo);
        Uploads.insert(fileInfo);
      },
      cacheTime: 100,
    });
  });
}

Meteor.methods({
  'deleteFile': function(_id) {
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
