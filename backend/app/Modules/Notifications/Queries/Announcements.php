<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Queries;

use App\Modules\Documents\PublicApi\DocumentStore;
use App\Modules\Notifications\Enums\CampaignAudience;
use App\Modules\Notifications\Enums\ErrorCode;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Models\Campaign;
use App\Modules\Notifications\Models\CampaignDelivery;
use App\Modules\Notifications\Models\Notification;
use App\Modules\Notifications\Support\AnnouncementView;
use App\Modules\Notifications\Support\CampaignMessage;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\Cursor;
use Illuminate\Pagination\CursorPaginator;
use Illuminate\Support\Str;

/**
 * Annonces d'un locataire ou d'un mandant : les lignes de notification qu'il peut encore voir (ADR 0027), complétées par la diffusion,
 * lue sous le contexte de l'organisation émettrice. Une page se lit en un nombre constant de requêtes par organisation.
 */
final readonly class Announcements
{
    private const string PREFIXE = 'campaign:';

    public function __construct(
        private VisibleNotifications $visibles,
        private CurrentOrganization $organisation,
        private OrganizationDirectory $organisations,
        private DocumentStore $documents,
        private CampaignMessage $messages,
    ) {}

    /**
     * @return CursorPaginator<int, AnnouncementView>
     */
    public function page(string $userId, CampaignAudience $audience, ?string $cursor, int $parPage): CursorPaginator
    {
        $page = $this->rows($userId, $audience)->orderByDesc('id')
            ->cursorPaginate($parPage, cursor: $cursor === null ? null : Cursor::fromEncoded($cursor));

        return $page->setCollection(collect($this->views(array_values($page->getCollection()->all()))));
    }

    public function find(string $userId, CampaignAudience $audience, string $campagneId): AnnouncementView
    {
        $ligne = Str::isUuid($campagneId) ? $this->rows($userId, $audience)->where('dedup_key', self::PREFIXE.strtolower($campagneId))->first() : null;
        $vue = $ligne === null ? null : ($this->views([$ligne])[0] ?? null);

        return $vue ?? throw ErrorCode::AnnouncementNotFound->problem();
    }

    /**
     * @return Builder<Notification>
     */
    public function rows(string $userId, CampaignAudience $audience): Builder
    {
        $type = $audience === CampaignAudience::Tenants ? NotificationType::TenantAnnouncement : NotificationType::OwnerAnnouncement;

        return $this->visibles->for($userId)->where('type', $type->value)->where('dedup_key', 'like', self::PREFIXE.'%');
    }

    /**
     * @param  list<Notification>  $lignes
     * @return list<AnnouncementView>
     */
    private function views(array $lignes): array
    {
        $parOrganisation = [];

        foreach ($lignes as $ligne) {
            if ($ligne->organization_id !== null) {
                $parOrganisation[$ligne->organization_id][] = $ligne;
            }
        }

        $noms = $this->organisations->names(array_keys($parOrganisation));
        $vues = [];

        foreach ($parOrganisation as $organisationId => $groupe) {
            /** @var array<string, AnnouncementView> $chargees */
            $chargees = $this->organisation->run((string) $organisationId, fn (): array => $this->load($groupe, $noms[$organisationId] ?? ''));
            $vues = [...$vues, ...$chargees];
        }

        $ordonnees = [];

        foreach ($lignes as $ligne) {
            if (isset($vues[$ligne->id])) {
                $ordonnees[] = $vues[$ligne->id];
            }
        }

        return $ordonnees;
    }

    /**
     * @param  list<Notification>  $lignes
     * @return array<string, AnnouncementView> par notification
     */
    private function load(array $lignes, string $nomOrganisation): array
    {
        $ids = array_map(fn (Notification $n): string => substr($n->dedup_key, strlen(self::PREFIXE)), $lignes);
        $campagnes = Campaign::query()->with('attachments')->whereIn('id', $ids)->get()->keyBy('id');
        $parties = array_values(array_filter(array_map(fn (Notification $n): ?string => $n->party_id, $lignes)));
        $envois = CampaignDelivery::query()->whereIn('party_id', $parties)->whereIn('campaign_id', $ids)->get()->keyBy(fn (CampaignDelivery $e): string => $e->campaign_id.'|'.$e->party_id);
        $fichiers = $this->documents->findMany(array_values($campagnes->flatMap(fn (Campaign $c): array => $c->attachments->map(fn ($p): string => $p->stored_file_id)->all())->all()));
        $vues = [];

        foreach ($lignes as $ligne) {
            $campagne = $campagnes[substr($ligne->dedup_key, strlen(self::PREFIXE))] ?? null;
            $envoi = $campagne === null ? null : ($envois[$campagne->id.'|'.$ligne->party_id] ?? null);

            if ($campagne === null || $envoi === null) {
                continue;
            }

            $pieces = [];

            foreach ($campagne->attachments as $piece) {
                if (isset($fichiers[$piece->stored_file_id])) {
                    $pieces[] = ['id' => $piece->id, 'name' => $fichiers[$piece->stored_file_id]->displayName, 'size_bytes' => $fichiers[$piece->stored_file_id]->sizeBytes];
                }
            }

            $vues[$ligne->id] = new AnnouncementView(
                $campagne->id,
                $ligne->id,
                $campagne->organization_id,
                $nomOrganisation,
                $this->messages->subject($campagne, $envoi),
                $this->messages->body($campagne, $envoi),
                $campagne->content_purged_at !== null,
                $campagne->sending_started_at,
                $ligne->read_at,
                $pieces,
            );
        }

        return $vues;
    }
}
