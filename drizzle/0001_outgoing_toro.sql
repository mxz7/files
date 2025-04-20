/*
 SQLite does not support "Drop not null from column" out of the box, we do not generate automatic migration for that, so it has to be done manually
 Please refer to: https://www.techonthenet.com/sqlite/tables/alter_table.php
                  https://www.sqlite.org/lang_altertable.html
                  https://stackoverflow.com/questions/2083543/modify-a-columns-type-in-sqlite3

 Due to that we don't generate migration automatically and it has to be done manually
*/

alter table uploads add column bytes_new integer;
--> statement-breakpoint
update uploads set bytes_new = bytes;
--> statement-breakpoint
alter table uploads drop column bytes;
--> statement-breakpoint
alter table uploads rename column bytes_new to bytes;