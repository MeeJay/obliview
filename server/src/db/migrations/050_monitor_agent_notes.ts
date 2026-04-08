import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('monitors', (t) => {
    t.text('notes').nullable();
  });
  await knex.schema.alterTable('agent_devices', (t) => {
    t.text('notes').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('monitors', (t) => {
    t.dropColumn('notes');
  });
  await knex.schema.alterTable('agent_devices', (t) => {
    t.dropColumn('notes');
  });
}
