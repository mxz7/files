#!/bin/sh
./node_modules/.bin/drizzle-kit migrate
exec node build
