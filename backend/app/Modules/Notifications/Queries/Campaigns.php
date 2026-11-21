<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Queries;

use App\Modules\Documents\PublicApi\DocumentStore;
use App\Modules\Notifications\Data\CampaignFilters;
use App\Modules\Notifications\Enums\CampaignStatus;
use App\Modules\Notifications\Enums\DeliveryStatus;
use App\Modules\Notifications\Enums\ErrorCode;
use App\Modules\Notifications\Models\Campaign;
use App\Modules\Notifications\Models\CampaignDelivery;
use App\Modules\Notifications\Support\CampaignView;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\Cursor;
use Illuminate\Pagination\CursorPaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Diffusions de l'organisation courante (le cloisonnement est celui du modèle). Une page se lit en un nombre constant de requêtes :
 * diffusions, pièces, effectifs groupés, fichiers.
 */
final readonly class Campaigns
{
    public function __construct(private DocumentStore $documents) {}

    /**
     * @return CursorPaginator<int, CampaignView>
     */
    public function page(CampaignFilters $filtres, ?string $cursor, int $parPage): CursorPaginator
    {
        $page = $this->filtered($filtres)->with('attachments')->orderByDesc('id')
            ->cursorPaginate($parPage, cursor: $cursor === null ? null : Cursor::fromEncoded($cursor));
        $vues = $this->views(array_values($page->getCollection()->all()));

        return $page->setCollection(collect($vues));
    }

    public function find(string $id): CampaignView
    {
        $campagne = (Str::isUuid($id) ? Campaign::query()->with('attachments')->find($id) : null) ?? throw ErrorCode::CampaignNotFound->problem();

        return $this->views([$campagne])[0];
    }

    /**
     * @return array<string, int> effectifs par statut, hors période et recherche
     */
    public function counts(): array
    {
        $parStatut = Campaign::query()->select('status', DB::raw('COUNT(*) AS n'))->groupBy('status')->pluck('n', 'status');
        $comptes = ['all' => (int) $parStatut->sum()];

        foreach (CampaignStatus::cases() as $statut) {
            $comptes[$statut->value] = (int) ($parStatut[$statut->value] ?? 0);
        }

        return $comptes;
    }

    /**
     * @return array{this_month: int, scheduled: int, sent_count: int, read_count: int, read_rate_percent: int|null, failures: int}
     */
    public function stats(): array
    {
        $debutDuMois = now()->startOfMonth()->format('Y-m-d H:i:s.u');
        $ceMois = Campaign::query()
            ->whereIn('status', [CampaignStatus::Sending->value, CampaignStatus::Sent->value])
            ->where('sending_started_at', '>=', $debutDuMois)->count();
        $programmees = Campaign::query()->where('status', CampaignStatus::Scheduled->value)->count();
        $envois = CampaignDelivery::query()
            ->selectRaw('SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) AS envoyes, SUM(CASE WHEN read_at IS NOT NULL THEN 1 ELSE 0 END) AS lus', [DeliveryStatus::Sent->value])
            ->first();
        $envoyes = (int) $envois?->getAttribute('envoyes');
        $lus = (int) $envois?->getAttribute('lus');

        return [
            'this_month' => $ceMois,
            'scheduled' => $programmees,
            'sent_count' => $envoyes,
            'read_count' => $lus,
            'read_rate_percent' => $envoyes === 0 ? null : (int) round($lus * 100 / $envoyes),
            'failures' => (int) Campaign::query()->sum('failed_count'),
        ];
    }

    /**
     * @return Builder<Campaign>
     */
    private function filtered(CampaignFilters $filtres): Builder
    {
        $requete = Campaign::query();

        if ($filtres->status !== null) {
            $requete->where('status', $filtres->status->value);
        }

        if ($filtres->search !== null) {
            $requete->where('subject', 'like', '%'.addcslashes($filtres->search, '%_\\').'%');
        }

        if ($filtres->buildingId !== null) {
            $requete->whereJsonContains('building_ids', $filtres->buildingId);
        }

        $depuis = match ($filtres->period) {
            'month' => now()->startOfMonth(),
            'quarter' => now()->startOfQuarter(),
            'year' => now()->startOfYear(),
            default => null,
        };

        if ($depuis !== null) {
            $requete->whereRaw('COALESCE(sent_at, scheduled_at, created_at) >= ?', [$depuis->format('Y-m-d H:i:s.u')]);
        }

        return $requete;
    }

    /**
     * @param  list<Campaign>  $campagnes
     * @return list<CampaignView>
     */
    private function views(array $campagnes): array
    {
        if ($campagnes === []) {
            return [];
        }

        $ids = array_map(fn (Campaign $c): string => $c->id, $campagnes);
        $effectifs = [];

        foreach (CampaignDelivery::query()->whereIn('campaign_id', $ids)->groupBy('campaign_id', 'status')
            ->selectRaw('campaign_id, status, COUNT(*) AS n, SUM(CASE WHEN read_at IS NOT NULL THEN 1 ELSE 0 END) AS lus, SUM(CASE WHEN unsubscribed_at IS NOT NULL THEN 1 ELSE 0 END) AS desinscrits')
            ->get() as $ligne) {
            $cle = $ligne->campaign_id;
            $effectifs[$cle][$ligne->status->value] = (int) $ligne->getAttribute('n');
            $effectifs[$cle]['read'] = ($effectifs[$cle]['read'] ?? 0) + (int) $ligne->getAttribute('lus');
            $effectifs[$cle]['unsubscribed'] = ($effectifs[$cle]['unsubscribed'] ?? 0) + (int) $ligne->getAttribute('desinscrits');
        }

        $fichiers = $this->documents->findMany(array_merge(...array_map(fn (Campaign $c): array => $c->attachments->map(fn ($p): string => $p->stored_file_id)->all(), $campagnes)));

        return array_map(function (Campaign $campagne) use ($effectifs, $fichiers): CampaignView {
            $pieces = [];

            foreach ($campagne->attachments as $piece) {
                if (isset($fichiers[$piece->stored_file_id])) {
                    $pieces[] = ['id' => $piece->id, 'name' => $fichiers[$piece->stored_file_id]->displayName, 'size_bytes' => $fichiers[$piece->stored_file_id]->sizeBytes];
                }
            }

            $mesures = [];

            foreach (DeliveryStatus::cases() as $statut) {
                $mesures[$statut->value] = $effectifs[$campagne->id][$statut->value] ?? 0;
            }

            $mesures['read'] = $effectifs[$campagne->id]['read'] ?? 0;
            $mesures['unsubscribed'] = $effectifs[$campagne->id]['unsubscribed'] ?? 0;

            return new CampaignView($campagne, $mesures, $pieces);
        }, $campagnes);
    }
}
