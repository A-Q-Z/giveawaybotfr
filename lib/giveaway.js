const { EmbedBuilder } = require('discord.js');

class Giveaway {
    constructor(client, channelId, prize, duration, winnersCount) {
        this.client = client;
        this.channelId = channelId;
        this.prize = prize;
        this.duration = duration;
        this.winnersCount = winnersCount;
        this.entries = new Set();
        this.colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#00FFFF', '#FF00FF']; // Palette de couleurs pour le changement d'embed
    }

    async start() {
        const channel = this.client.channels.cache.get(this.channelId);
        if (!channel) throw new Error('ID de salon invalide');

        let countdown = this.duration;

        const embed = new EmbedBuilder()
            .setTitle('🎉 **GIVEAWAY** 🎉')
            .setDescription(`**Prix :** ${this.prize}\n**Durée :** ${countdown} secondes restantes\n**Gagnants :** ${this.winnersCount}`)
            .setColor(this.colors[0])
            .setTimestamp();

        const giveawayMessage = await channel.send({ embeds: [embed] });

        giveawayMessage.react('🎉');

        const filter = (reaction, user) => reaction.emoji.name === '🎉' && !user.bot;
        const collector = giveawayMessage.createReactionCollector({ filter, time: this.duration * 1000 });

        const interval = setInterval(async () => {
            if (countdown <= 0) {
                clearInterval(interval);
                return;
            }

            countdown -= 1; // On décrémente le compte à rebours de 1 seconde
            embed.setDescription(`**Prix :** ${this.prize}\n**Durée :** ${countdown} secondes restantes\n**Gagnants :** ${this.winnersCount}`);
            embed.setColor(this.colors[Math.floor(Math.random() * this.colors.length)]);

            await giveawayMessage.edit({ embeds: [embed] });
        }, 1000);

        collector.on('collect', (reaction, user) => {
            this.entries.add(user.id);
        });

        collector.on('end', () => {
            clearInterval(interval);
            this.pickWinners(channel);
        });
    }

    pickWinners(channel) {
        if (this.entries.size === 0) {
            channel.send('Aucune participation, aucun gagnant.');
            return;
        }

        const winners = [...this.entries].sort(() => Math.random() - 0.5).slice(0, this.winnersCount);
        const winnersList = winners.map(id => `<@${id}>`).join(', ');

        const embed = new EmbedBuilder()
            .setTitle('🎉 **GIVEAWAY TERMINÉ** 🎉')
            .setDescription(`Félicitations ${winnersList} ! Vous avez gagné **${this.prize}** !`)
            .setColor('#FFD700') // Couleur or pour célébrer les gagnants
            .setTimestamp();

        channel.send({ embeds: [embed] });
    }
}

module.exports = Giveaway;
