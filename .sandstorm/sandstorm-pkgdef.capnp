@0xdd431d36d7a842e1;

using Spk = import "/sandstorm/package.capnp";
# This imports:
#   $SANDSTORM_HOME/latest/usr/include/sandstorm/package.capnp
# Check out that file to see the full, documented package definition format.

const pkgdef :Spk.PackageDefinition = (
  # The package definition. Note that the spk tool looks specifically for the
  # "pkgdef" constant.

  id = "xzj203ga5mpguj9hscn8a31rd9fr6uupgjx6njfx5kyhtxjmcj9h",
  # Your app ID is actually its public key. The private key was placed in
  # your keyring. All updates must be signed with the same key.

  manifest = (
    # This manifest is included in your app package to tell Sandstorm
    # about your app.

    appTitle = (defaultText = "Dropzone"),

    appVersion = 0,  # Increment this for every release.

    appMarketingVersion = (defaultText = "0.0.0"),
    # Human-readable representation of appVersion. Should match the way you
    # identify versions of your app in documentation and marketing.

    actions = [
      # Define your "new document" handlers here.
      ( title = (defaultText = "New dropzone"),
        command = .myCommand
        # The command to run when starting for the first time. (".myCommand"
        # is just a constant defined at the bottom of the file.)
      )
    ],

    continueCommand = .myCommand
    # This is the command called to start your app back up after it has been
    # shut down for inactivity. Here we're using the same command as for
    # starting a new instance, but you could use different commands for each
    # case.
  ),

  sourceMap = (
    # The following directories will be copied into your package.
    searchPath = [
      ( sourcePath = "/home/vagrant/bundle" ),
      ( sourcePath = "/opt/meteor-spk/meteor-spk.deps" )
    ]
  ),

  alwaysInclude = [ "." ],
  # This says that we always want to include all files from the source map.
  # (An alternative is to automatically detect dependencies by watching what
  # the app opens while running in dev mode. To see what that looks like,
  # run `spk init` without the -A option.)


  bridgeConfig = (
    viewInfo = (
      permissions = [(name = "modify", title = (defaultText = "modify"),
                      description = (defaultText = "allows managing content"))],
      roles = [(title = (defaultText = "editor"),
                permissions = [true],
                verbPhrase = (defaultText = "can edit"),
                default = true),
               (title = (defaultText = "viewer"),
                permissions = [false],
                verbPhrase = (defaultText = "can view"))]
    )
  )
);

const myCommand :Spk.Manifest.Command = (
  # Here we define the command used to start up your server.
  argv = ["/sandstorm-http-bridge", "8000", "--", "/opt/app/.sandstorm/launcher.sh"],
  environ = [
    # Note that this defines the *entire* environment seen by your app.
    (key = "PATH", value = "/usr/local/bin:/usr/bin:/bin")
  ]
);
