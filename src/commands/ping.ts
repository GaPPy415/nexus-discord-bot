import type { CommandInteraction } from 'discord.js';

import { Command } from '@sapphire/framework';

export class PingCommand extends Command {
  constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      description: 'Replies with Pong!',
      name: 'ping',
    });
  }

  // eslint-disable-next-line class-methods-use-this
  override async chatInputRun(interaction: CommandInteraction) {
    await interaction.reply('Pong!');
  }
}
