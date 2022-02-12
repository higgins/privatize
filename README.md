# privatize
Partially encrypt/decrypt a file based on the presence of the heredoc
===================================================================================

`privatize` enables partial encryption/decryption of files based on the
presence of a [heredoc](https://en.wikipedia.org/wiki/Here_document)
`<<PRIVATE`.

When installed in a git repository, files you choose to protect will
have the contents of the heredoc `<<PRIVATE` automatically encrypted
on commit and decrypted on checkout while the rest of the file remains
untouched.

Inspired by [git-crypt](https://github.com/AGWA/git-crypt).

## Installation
TODO: `npm i -g privatize`

## Using with git
To configure a repository to use `privatize`:
```
cd yourRepo
privatize init
```

Specify files to partially encrypt/decrypt by creating a
[.gitattributes](https://git-scm.com/book/en/v2/Customizing-Git-Git-Attributes)
file:

```
someSecretFile filter=privatize diff=privatize
*.org filter=privatize diff=privatize
credentials/*.md filter=privatize diff=privatize
```

Copy your symmetric key to a secure place:
```
privatize export exampleKeyFilename.key
```

Unlock a newly cloned repo:
```
privatize unlock exampleKeyFilename.key
```

Once you've either `privatize init` or `privatize unlock`'d your repo
and updated your `.gitattributes` file, use git as you normally would
and your files will be transparently encrypted/decrytped.

## Motivation

I keep a daily journal in an org-mode file shared publicly. I share it
publicly because I like to hold myself accountable to that. I often
describe parts of my life that for one reason or another should be
kept private (significant details of my friends and family, ongoing
status of to-be-launched projects, etc) and don't want to have to
change contexts (files) to document those aspects.

Voilà.

## Current status

This repo resents the gist of the idea but [I've just discovered that
using a fixed IV](https://github.com/AGWA/git-crypt#security) for
encryption/decryption can leak information...so some significant parts
of this code will be re-written.

## Security

I'm still building confidence that this encryption/decryption scheme
is secure. Best to not rely on it for anything serious just yet.

One rule holds true:
[**Never share the private key with those you don't want reading your encrypted data, Frodo Baggins!**](https://www.youtube.com/watch?v=iThtELZvfPs)

## TODO
- [X] privatize init
- [X] privatize export filename.key
- [X] privatize clean
- [X] privatize smudge
- [X] privatize unlock
- [X] privatize --help
- [ ] privatize solo
- [ ] Add encrypt / decrypt (user facing, expect encryption key)
- [ ] Use SHA-1 HMAC of file as IV?
- [ ] Allow standalone tool
  - [ ] specify key+iv file
- [ ] Allow for user specified HEREDOC string (<<CREDENTIALS)
- [ ] Allow HEREDOC to start and end mid-line
- [ ] Publish in NPM
