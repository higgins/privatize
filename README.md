Partially encrypt/decrypt a file based on the presence of a heredoc
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
privatize git-init
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
privatize export-key exampleKeyFilename.key
```

Unlock a newly cloned repo:
```
privatize git-unlock exampleKeyFilename.key
```

Once you've either `privatize git-init` or `privatize git-unlock`'d
your repo and updated your `.gitattributes` file, use git as you
normally would and your files will be transparently
encrypted/decrytped.

## Using with pipes

```
# Encrypt a file and pipe to stdout
cat someFileToPartiallyEncrypt | privatize encrypt privatize.key

# Decrypt a file and pipe to stdout
cat someFileToPartiallyDecrypt | privatize decrypt privatize.key
```

## Markup example

To privatize the contents of a file, make sure you wrap your text to
be privatized with `<<PRIVATE` and `PRIVATE`. For now, both tags must
start at the beginning of the line.

```
# example.txt

Today I a burrito. 🌯
<<PRIVATE
I was on the toilet for hours.
PRIVATE
I got a lot of reading done.
```
Once privatized becomes

```
# example.txt

Today I a burrito. 🌯
<<PRIVATE
xuJ0fld2vmNWaVLogTIufmWsiFso
PRIVATE
I got a lot of reading done.
```

## Motivation

I keep a daily journal in an org-mode file shared publicly. I share it
publicly because I like to hold myself accountable to that. I often
describe parts of my life that for one reason or another should be
kept private (significant details of my friends and family, ongoing
status of to-be-launched projects, etc) and don't want to have to
change contexts (files) to document those aspects.

Voilà.

## Practical uses

Aside from how I use it, here are some other useful applications:

- Transparent legal documentation with PII redacted
- Privatizing content for paying customers
- Anywhere the concept of [literate
  programming](https://en.wikipedia.org/wiki/Literate_programming)
  applies


## Current status

This is a functioning prototype and I'm open to suggestions for
improvements. [Ping me](https://twitter.com/justinprojects) or submit
a pull-request!

## Security

`privatize`'s encryption scheme is shamelessly borrowed from
`git-crypt`'s. We encrypt the contents of heredocs using AES-256 in
CTR mode with a synthetic IV derived from the blob's SHA-1 HMAC.

One rule holds true:
[**Never share the private key with those you don't want reading your encrypted data, Frodo Baggins!**](https://www.youtube.com/watch?v=iThtELZvfPs)

## TODO
- [ ] Allow for user specified HEREDOC string (<<CREDENTIALS)
- [ ] Allow HEREDOC to start and end mid-line
- [ ] Publish in NPM
- [ ] Distribute in homebrew
