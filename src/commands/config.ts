import { Command } from '@sapphire/framework';
import { ChannelType, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { eq } from 'drizzle-orm';

import { db } from '../db/index.js';
import { guildConfig } from '../db/schema.js';

export class ConfigCommand extends Command {
  constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      description: 'Configure server settings',
      name: 'config',
    });
  }

  override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    if (!interaction.guild) {
      await interaction.reply({
        content: '❌ This command can only be used in a server.',
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    const subcommandGroup = interaction.options.getSubcommandGroup();
    const subcommand = interaction.options.getSubcommand();

    if (subcommandGroup === 'starboard') {
      switch (subcommand) {
        case 'channel':
          await this.handleSetStarboardChannel(interaction);
          break;
        case 'disable':
          await this.handleDisableStarboard(interaction);
          break;
        case 'status':
          await this.handleStarboardStatus(interaction);
          break;
        case 'threshold':
          await this.handleSetStarboardThreshold(interaction);
          break;
        default:
          await interaction.reply({
            content: '❌ Unknown subcommand.',
            flags: [MessageFlags.Ephemeral],
          });
      }
    }
  }

  override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.name)
        .setDescription(this.description)
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommandGroup((group) =>
          group
            .setName('starboard')
            .setDescription('Configure starboard settings')
            .addSubcommand((subcommand) =>
              subcommand
                .setName('channel')
                .setDescription('Set the starboard channel')
                .addChannelOption((option) =>
                  option
                    .setName('channel')
                    .setDescription('The channel for starboard messages')
                    .addChannelTypes(ChannelType.GuildText)
                    .setRequired(true),
                ),
            )
            .addSubcommand((subcommand) =>
              subcommand
                .setName('threshold')
                .setDescription(
                  'Set the minimum stars required for starboard (default: 3)',
                )
                .addIntegerOption((option) =>
                  option
                    .setName('count')
                    .setDescription('Number of stars required')
                    .setMinValue(1)
                    .setMaxValue(50)
                    .setRequired(true),
                ),
            )
            .addSubcommand((subcommand) =>
              subcommand
                .setName('disable')
                .setDescription('Disable the starboard'),
            )
            .addSubcommand((subcommand) =>
              subcommand
                .setName('status')
                .setDescription('View current starboard configuration'),
            ),
        ),
    );
  }

  private async handleDisableStarboard(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const { guildId } = interaction;
    if (!guildId) return;

    await db
      .update(guildConfig)
      .set({
        starboardChannelId: null,
        updatedAt: new Date(),
      })
      .where(eq(guildConfig.guildId, guildId));

    await interaction.reply({
      content: '✅ Starboard has been disabled.',
      flags: [MessageFlags.Ephemeral],
    });
  }

  private async handleSetStarboardChannel(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const channel = interaction.options.getChannel('channel', true);
    const { guildId } = interaction;
    if (!guildId) return;

    await db
      .insert(guildConfig)
      .values({
        guildId,
        starboardChannelId: channel.id,
      })
      .onConflictDoUpdate({
        set: {
          starboardChannelId: channel.id,
          updatedAt: new Date(),
        },
        target: guildConfig.guildId,
      });

    await interaction.reply({
      content: `✅ Starboard channel set to <#${channel.id}>`,
      flags: [MessageFlags.Ephemeral],
    });
  }

  private async handleSetStarboardThreshold(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const count = interaction.options.getInteger('count', true);
    const { guildId } = interaction;
    if (!guildId) return;

    await db
      .insert(guildConfig)
      .values({
        guildId,
        starboardThreshold: count,
      })
      .onConflictDoUpdate({
        set: {
          starboardThreshold: count,
          updatedAt: new Date(),
        },
        target: guildConfig.guildId,
      });

    await interaction.reply({
      content: `✅ Starboard threshold set to **${count}** stars`,
      flags: [MessageFlags.Ephemeral],
    });
  }

  private async handleStarboardStatus(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const { guildId } = interaction;
    if (!guildId) return;

    const config = db
      .select()
      .from(guildConfig)
      .where(eq(guildConfig.guildId, guildId))
      .get();

    if (!config?.starboardChannelId) {
      await interaction.reply({
        content:
          '📋 **Starboard Status**\n\n❌ Starboard is not configured.\n\nUse `/config starboard channel` to set it up.',
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    await interaction.reply({
      content: `📋 **Starboard Status**\n\n✅ **Enabled**\n📌 Channel: <#${config.starboardChannelId}>\n⭐ Threshold: **${config.starboardThreshold ?? 3}** stars`,
      flags: [MessageFlags.Ephemeral],
    });
  }
}
