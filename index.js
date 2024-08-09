const { Client, GatewayIntentBits, REST, Routes, Events, PermissionsBitField, EmbedBuilder, Collection } = require('discord.js');
const dotenv = require('dotenv');
const Giveaway = require('./lib/giveaway');

dotenv.config();

const clientId = process.env.CLIENT_ID;
const token = process.env.TOKEN;

if (!clientId || !token) {
    console.error('CLIENT_ID et TOKEN doivent être définis dans le fichier .env');
    process.exit(1);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions
    ],
});

client.giveaways = new Collection(); // Pour stocker les giveaways actifs

const commands = [
    {
        name: 'startgiveaway',
        description: 'Lancer un giveaway dans un salon spécifique.',
        options: [
            {
                name: 'salon',
                type: 7, // Channel type
                description: 'Le salon où le giveaway aura lieu',
                required: true,
            },
            {
                name: 'prix',
                type: 3, // String type
                description: 'Le prix du giveaway',
                required: true,
            },
            {
                name: 'durée',
                type: 4, // Integer type
                description: 'Durée du giveaway en secondes',
                required: true,
            },
            {
                name: 'gagnants',
                type: 4, // Integer type
                description: 'Nombre de gagnants',
                required: true,
            },
        ],
    },
    {
        name: 'ping',
        description: 'Mentionne @everyone et supprime le message après une seconde.',
    },
    {
        name: 'reroll',
        description: 'Relancer le tirage pour choisir un nouveau gagnant du giveaway.',
        options: [
            {
                name: 'salon',
                type: 7, // Channel type
                description: 'Le salon où le giveaway a eu lieu',
                required: true,
            },
            {
                name: 'message_id',
                type: 3, // String type
                description: 'L\'ID du message du giveaway',
                required: true,
            },
        ],
    },
    {
        name: 'endgiveaway',
        description: 'Terminer un giveaway en cours.',
        options: [
            {
                name: 'salon',
                type: 7, // Channel type
                description: 'Le salon où le giveaway a lieu',
                required: true,
            },
            {
                name: 'message_id',
                type: 3, // String type
                description: 'L\'ID du message du giveaway',
                required: true,
            },
        ],
    },
    {
        name: 'listgiveaways',
        description: 'Lister tous les giveaways en cours sur le serveur.',
    },
    {
        name: 'deletegiveaway',
        description: 'Supprimer un giveaway spécifique en utilisant son ID de message.',
        options: [
            {
                name: 'salon',
                type: 7, // Channel type
                description: 'Le salon où le giveaway a lieu',
                required: true,
            },
            {
                name: 'message_id',
                type: 3, // String type
                description: 'L\'ID du message du giveaway',
                required: true,
            },
        ],
    },
    {
        name: 'extendgiveaway',
        description: 'Étendre la durée d\'un giveaway en cours.',
        options: [
            {
                name: 'salon',
                type: 7, // Channel type
                description: 'Le salon où le giveaway a lieu',
                required: true,
            },
            {
                name: 'message_id',
                type: 3, // String type
                description: 'L\'ID du message du giveaway',
                required: true,
            },
            {
                name: 'temps',
                type: 4, // Integer type
                description: 'Le nombre de secondes à ajouter',
                required: true,
            },
        ],
    },
    {
        name: 'cancelgiveaway',
        description: 'Annuler un giveaway en cours.',
        options: [
            {
                name: 'salon',
                type: 7, // Channel type
                description: 'Le salon où le giveaway a lieu',
                required: true,
            },
            {
                name: 'message_id',
                type: 3, // String type
                description: 'L\'ID du message du giveaway',
                required: true,
            },
        ],
    },
    {
        name: 'info',
        description: 'Obtenir des informations détaillées sur un giveaway.',
        options: [
            {
                name: 'salon',
                type: 7, // Channel type
                description: 'Le salon où le giveaway a lieu',
                required: true,
            },
            {
                name: 'message_id',
                type: 3, // String type
                description: 'L\'ID du message du giveaway',
                required: true,
            },
        ],
    },
];

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        console.log('Commencez à rafraîchir les commandes d\'application (/)');

        await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands },
        );

        console.log('Les commandes d\'application (/) ont été rechargées avec succès.');
    } catch (error) {
        console.error(error);
    }
})();

client.once('ready', async () => {
    console.log(`Connecté en tant que ${client.user.tag}`);

    const guilds = client.guilds.cache.map(guild => guild);

    guilds.forEach(async (guild) => {
        let role = guild.roles.cache.find(r => r.name === "Permissions Giveaway");

        if (!role) {
            try {
                role = await guild.roles.create({
                    name: "Permissions Giveaway",
                    color: "#FFD700",
                    permissions: [PermissionsBitField.Flags.SendMessages]
                });
                console.log(`Rôle "Permissions Giveaway" créé dans ${guild.name}`);
            } catch (error) {
                console.error(`Erreur lors de la création du rôle dans ${guild.name}:`, error);
            }
        } else {
            console.log(`Rôle "Permissions Giveaway" déjà existant dans ${guild.name}`);
        }
    });
});

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isCommand()) return;

    const member = interaction.member;
    const role = member.roles.cache.find(r => r.name === "Permissions Giveaway");

    if (!role) {
        await interaction.reply({ content: 'Vous n\'avez pas la permission d\'utiliser cette commande. Veuillez contacter un administrateur.', ephemeral: true });
        return;
    }

    const { commandName } = interaction;

    if (commandName === 'startgiveaway') {
        const channel = interaction.options.getChannel('salon');
        const prize = interaction.options.getString('prix');
        const duration = interaction.options.getInteger('durée');
        const winnersCount = interaction.options.getInteger('gagnants');

        if (!channel || !prize || !duration || !winnersCount) {
            await interaction.reply({ content: 'Tous les paramètres sont obligatoires !', ephemeral: true });
            return;
        }

        try {
            const giveaway = new Giveaway(client, channel.id, prize, duration, winnersCount);
            const giveawayMessage = await giveaway.start();

            // Stocker les informations du giveaway pour un usage ultérieur
            client.giveaways.set(giveawayMessage.id, {
                channelId: channel.id,
                messageId: giveawayMessage.id,
                prize: prize,
                duration: duration,
                winnersCount: winnersCount,
                entries: giveaway.entries
            });

            await interaction.reply({ content: `Giveaway lancé dans ${channel.name} pour **${prize}** !`, ephemeral: true });
        } catch (error) {
            await interaction.reply({ content: 'Une erreur est survenue : ' + error.message, ephemeral: true });
        }
    }

    if (commandName === 'ping') {
        const message = await interaction.reply({
            content: '@everyone',
            allowedMentions: { parse: ['everyone'] },
            fetchReply: true
        });
        setTimeout(() => message.delete(), 1000);
    }

    if (commandName === 'reroll') {
        const channel = interaction.options.getChannel('salon');
        const messageId = interaction.options.getString('message_id');

        try {
            const message = await channel.messages.fetch(messageId);
            if (!message) {
                return interaction.reply({ content: 'Message non trouvé. Veuillez vérifier l\'ID du message.', ephemeral: true });
            }

            const reaction = message.reactions.cache.get('🎉');
            if (!reaction) {
                return interaction.reply({ content: 'Pas de réactions 🎉 trouvées sur ce message.', ephemeral: true });
            }

            const users = await reaction.users.fetch();
            const participants = users.filter(user => !user.bot);

            if (participants.size === 0) {
                return interaction.reply({ content: 'Aucun participant trouvé pour ce giveaway.', ephemeral: true });
            }

            const winner = participants.random();
            const embed = new EmbedBuilder()
                .setTitle('🎉 **Nouveau gagnant !** 🎉')
                .setDescription(`Le nouveau gagnant est : <@${winner.id}> ! Félicitations !`)
                .setColor('#FFD700')
                .setTimestamp();
            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'Une erreur est survenue lors du reroll : ' + error.message, ephemeral: true });
        }
    }

    if (commandName === 'endgiveaway') {
        const channel = interaction.options.getChannel('salon');
        const messageId = interaction.options.getString('message_id');

        try {
            const message = await channel.messages.fetch(messageId);
            if (!message) {
                return interaction.reply({ content: 'Message non trouvé. Veuillez vérifier l\'ID du message.', ephemeral: true });
            }

            const reaction = message.reactions.cache.get('🎉');
            if (!reaction) {
                return interaction.reply({ content: 'Pas de réactions 🎉 trouvées sur ce message.', ephemeral: true });
            }

            reaction.remove().catch(error => console.error('Failed to remove reactions:', error));

            const embed = new EmbedBuilder()
                .setTitle('🎉 **Giveaway terminé !** 🎉')
                .setDescription('Le giveaway a été terminé de manière anticipée.')
                .setColor('#FF0000')
                .setTimestamp();

            await message.edit({ embeds: [embed] });
            await interaction.reply({ content: 'Le giveaway a été terminé avec succès.', ephemeral: true });

            // Retirer le giveaway de la liste active
            client.giveaways.delete(messageId);
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'Une erreur est survenue lors de la fin du giveaway : ' + error.message, ephemeral: true });
        }
    }

    if (commandName === 'listgiveaways') {
        const activeGiveaways = client.giveaways.map((giveaway, messageId) => {
            return `**Salon:** <#${giveaway.channelId}> **Prix:** ${giveaway.prize} **Message ID:** ${messageId}`;
        }).join('\n');

        if (activeGiveaways.length === 0) {
            return interaction.reply({ content: 'Aucun giveaway en cours.', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setTitle('🎉 **Giveaways en cours** 🎉')
            .setDescription(activeGiveaways)
            .setColor('#00FF00')
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (commandName === 'deletegiveaway') {
        const channel = interaction.options.getChannel('salon');
        const messageId = interaction.options.getString('message_id');

        try {
            const message = await channel.messages.fetch(messageId);
            if (!message) {
                return interaction.reply({ content: 'Message non trouvé. Veuillez vérifier l\'ID du message.', ephemeral: true });
            }

            await message.delete();
            await interaction.reply({ content: 'Le giveaway a été supprimé avec succès.', ephemeral: true });

            // Retirer le giveaway de la liste active
            client.giveaways.delete(messageId);
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'Une erreur est survenue lors de la suppression du giveaway : ' + error.message, ephemeral: true });
        }
    }

    if (commandName === 'extendgiveaway') {
        const channel = interaction.options.getChannel('salon');
        const messageId = interaction.options.getString('message_id');
        const extraTime = interaction.options.getInteger('temps');

        const giveaway = client.giveaways.get(messageId);

        if (!giveaway) {
            return interaction.reply({ content: 'Giveaway non trouvé ou déjà terminé.', ephemeral: true });
        }

        giveaway.duration += extraTime;

        // Mettre à jour le message du giveaway
        const message = await channel.messages.fetch(messageId);
        if (message) {
            const embed = message.embeds[0];
            if (embed) {
                const updatedEmbed = EmbedBuilder.from(embed)
                    .setDescription(`**Prix :** ${giveaway.prize}\n**Durée restante :** ${giveaway.duration} secondes\n**Gagnants :** ${giveaway.winnersCount}`)
                    .setColor('#FFFF00');

                await message.edit({ embeds: [updatedEmbed] });
            }
        }

        await interaction.reply({ content: `Le temps du giveaway a été étendu de ${extraTime} secondes.`, ephemeral: true });
    }

    if (commandName === 'cancelgiveaway') {
        const channel = interaction.options.getChannel('salon');
        const messageId = interaction.options.getString('message_id');

        try {
            const message = await channel.messages.fetch(messageId);
            if (!message) {
                return interaction.reply({ content: 'Message non trouvé. Veuillez vérifier l\'ID du message.', ephemeral: true });
            }

            const embed = new EmbedBuilder()
                .setTitle('🎉 **Giveaway annulé !** 🎉')
                .setDescription('Le giveaway a été annulé.')
                .setColor('#FF0000')
                .setTimestamp();

            await message.edit({ embeds: [embed] });
            await interaction.reply({ content: 'Le giveaway a été annulé avec succès.', ephemeral: true });

            // Retirer le giveaway de la liste active
            client.giveaways.delete(messageId);
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'Une erreur est survenue lors de l\'annulation du giveaway : ' + error.message, ephemeral: true });
        }
    }

    if (commandName === 'info') {
        const channel = interaction.options.getChannel('salon');
        const messageId = interaction.options.getString('message_id');

        try {
            const message = await channel.messages.fetch(messageId);
            if (!message) {
                return interaction.reply({ content: 'Message non trouvé. Veuillez vérifier l\'ID du message.', ephemeral: true });
            }

            const reaction = message.reactions.cache.get('🎉');
            if (!reaction) {
                return interaction.reply({ content: 'Pas de réactions 🎉 trouvées sur ce message.', ephemeral: true });
            }

            const users = await reaction.users.fetch();
            const participants = users.filter(user => !user.bot);

            const embed = new EmbedBuilder()
                .setTitle('🎉 **Informations sur le Giveaway** 🎉')
                .setDescription(`**Participants :** ${participants.size}\n**Prix :** ${client.giveaways.get(messageId)?.prize || 'N/A'}\n**Gagnants :** ${client.giveaways.get(messageId)?.winnersCount || 'N/A'}`)
                .setColor('#00FF00')
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'Une erreur est survenue lors de la récupération des informations du giveaway : ' + error.message, ephemeral: true });
        }
    }
});

client.login(token);
