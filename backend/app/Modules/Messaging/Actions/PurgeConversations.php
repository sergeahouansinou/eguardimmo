<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Actions;

use App\Modules\Leases\Enums\ErrorCode as LeasesError;
use App\Modules\Leases\PublicApi\LeaseDirectory;
use App\Modules\Mandates\Data\MandateData;
use App\Modules\Mandates\PublicApi\MandateDirectory;
use App\Modules\Messaging\Enums\ConversationKind;
use App\Modules\Messaging\Models\Conversation;
use App\Modules\Messaging\Models\ConversationAttachment;
use App\Modules\Messaging\Models\ConversationMessage;
use App\Modules\Messaging\Queries\PurgeCandidates;
use App\Modules\Messaging\Support\AttachmentPurger;
use App\Shared\Audit\RecordAudit;
use App\Shared\Http\ApiProblem;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * Purge des fils (ADR 0033, décision 12) : 5 ans après le dernier message, repoussés à 5 ans après la fin du bail (fil locataire) ou du
 * mandat (fil mandant lié à un mandat). Un bail sans fin n'est jamais purgé. Les corps deviennent `[effacé]` et les pièces sont purgées ;
 * les lignes, dates, auteurs et objets restent. Rejouable : un fil déjà purgé n'est pas retouché.
 */
final readonly class PurgeConversations
{
    public const int ANNEES = 5;

    private const int LOT = 200;

    public function __construct(
        private PurgeCandidates $candidats,
        private CurrentOrganization $contexte,
        private LeaseDirectory $baux,
        private MandateDirectory $mandats,
        private AttachmentPurger $pieces,
        private RecordAudit $audit,
    ) {}

    /**
     * @return array{purged: int, failures: list<string>}
     */
    public function handle(): array
    {
        $bilan = ['purged' => 0, 'failures' => []];
        $apres = null;

        do {
            $lot = $this->candidats->threads(CarbonImmutable::now()->subYears(self::ANNEES), $apres, self::LOT);
            $apres = $lot === [] ? null : $lot[array_key_last($lot)]['id'];

            foreach ($this->parOrganisation($lot) as $organisation => $fils) {
                try {
                    $this->contexte->run($organisation, function () use ($fils, &$bilan): void {
                        $bilan['purged'] += $this->purger($fils, $bilan['failures']);
                    });
                } catch (Throwable $erreur) {
                    report($erreur);
                    $bilan['failures'][] = "{$organisation} : ".$erreur::class;
                }
            }
        } while (count($lot) === self::LOT);

        return $bilan;
    }

    /**
     * @param  list<array{id: string, organization_id: string, kind: string, lease_id: ?string, mandate_id: ?string, last_message_at: CarbonImmutable}>  $lot
     * @return array<string, list<array{id: string, organization_id: string, kind: string, lease_id: ?string, mandate_id: ?string, last_message_at: CarbonImmutable}>>
     */
    private function parOrganisation(array $lot): array
    {
        $groupes = [];

        foreach ($lot as $fil) {
            $groupes[$fil['organization_id']][] = $fil;
        }

        return $groupes;
    }

    /**
     * @param  list<array{id: string, organization_id: string, kind: string, lease_id: ?string, mandate_id: ?string, last_message_at: CarbonImmutable}>  $fils
     * @param  list<string>  $echecs
     */
    private function purger(array $fils, array &$echecs): int
    {
        $mandats = $this->mandats->findMany(array_values(array_unique(array_filter(array_column($fils, 'mandate_id')))));
        $purges = 0;

        foreach ($fils as $fil) {
            $echeance = $this->echeance($fil, $mandats);

            if ($echeance === null || $echeance->isFuture()) {
                continue;
            }

            try {
                $purges += DB::transaction(fn (): int => $this->effacer($fil['id']));
            } catch (Throwable $erreur) {
                report($erreur);
                $echecs[] = "{$fil['id']} : ".$erreur::class;
            }
        }

        return $purges;
    }

    /**
     * @param  array{id: string, organization_id: string, kind: string, lease_id: ?string, mandate_id: ?string, last_message_at: CarbonImmutable}  $fil
     * @param  array<string, MandateData>  $mandats
     */
    private function echeance(array $fil, array $mandats): ?CarbonImmutable
    {
        $echeance = $fil['last_message_at']->addYears(self::ANNEES);

        if ($fil['kind'] === ConversationKind::Tenant->value && $fil['lease_id'] !== null) {
            return $this->echeanceBail($fil['lease_id'], $echeance);
        }

        if ($fil['kind'] === ConversationKind::Owner->value && $fil['mandate_id'] !== null && isset($mandats[$fil['mandate_id']])) {
            return max($echeance, CarbonImmutable::parse($mandats[$fil['mandate_id']]->endDate)->addDay()->addYears(self::ANNEES));
        }

        return $echeance;
    }

    /**
     * Trois états : bail trouvé (5 ans après sa fin, jamais s'il n'en a pas), bail absent (`lease_not_found` explicite : le dernier message
     * seul compte), bail non vérifiable (toute autre erreur : le fil est sauté, jamais purgé sur une panne).
     */
    private function echeanceBail(string $bailId, CarbonImmutable $echeance): ?CarbonImmutable
    {
        try {
            $bail = $this->baux->find($bailId);
        } catch (ApiProblem $probleme) {
            return $probleme->problemCode === LeasesError::LeaseNotFound->value ? $echeance : null;
        }

        return $bail->endsOn === null ? null : max($echeance, CarbonImmutable::parse($bail->endsOn)->addYears(self::ANNEES));
    }

    private function effacer(string $filId): int
    {
        $fil = Conversation::query()->whereKey($filId)->lockForUpdate()->first();

        if ($fil === null || $fil->content_purged_at !== null || $fil->last_message_at->addYears(self::ANNEES)->isFuture()) {
            return 0;
        }

        $messages = ConversationMessage::query()->where('conversation_id', $fil->id)->pluck('id')->all();
        $pieces = ConversationAttachment::query()->whereIn('conversation_message_id', $messages)->get();

        foreach ($pieces as $piece) {
            $this->pieces->purge($piece);
        }

        $effaces = ConversationMessage::query()
            ->where('conversation_id', $fil->id)
            ->where('body', '!=', ErasePartyMessages::TEXTE)
            ->update(['body' => ErasePartyMessages::TEXTE]);

        $fil->forceFill(['content_purged_at' => now(), 'counterpart_muted_reason' => null])->save();
        $this->audit->handle('messaging.conversation.content_purged', subject: $fil, metadata: ['kind' => $fil->kind->value, 'messages' => $effaces, 'attachments' => $pieces->count()]);

        return 1;
    }
}
