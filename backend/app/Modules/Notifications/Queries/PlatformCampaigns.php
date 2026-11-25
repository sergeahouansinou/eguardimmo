<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Queries;

use App\Modules\Identity\Models\User;
use App\Modules\Notifications\Enums\ErrorCode;
use App\Modules\Notifications\Enums\MarketingAudience;
use App\Modules\Notifications\Enums\PlatformCampaignStatus;
use App\Modules\Notifications\Models\PlatformCampaign;
use App\Modules\Notifications\Models\PlatformCampaignDelivery;
use App\Modules\Notifications\Models\PlatformCampaignImage;
use Illuminate\Contracts\Pagination\CursorPaginator;
use Illuminate\Support\Facades\DB;

final class PlatformCampaigns
{
    public function find(string $id): PlatformCampaign
    {
        return PlatformCampaign::query()->with('images')->find($id) ?? throw ErrorCode::PlatformCampaignNotFound->problem();
    }

    /**
     * Lecture sous verrou, à appeler dans une transaction.
     */
    public function locked(string $id): PlatformCampaign
    {
        return PlatformCampaign::query()->whereKey($id)->lockForUpdate()->first() ?? throw ErrorCode::PlatformCampaignNotFound->problem();
    }

    public function image(string $campagneId, string $imageId): PlatformCampaignImage
    {
        return PlatformCampaignImage::query()->where('campaign_id', $campagneId)->whereKey($imageId)->first()
            ?? throw ErrorCode::PlatformCampaignNotFound->problem();
    }

    /**
     * @return CursorPaginator<int, PlatformCampaign>
     */
    public function page(?PlatformCampaignStatus $statut, ?string $curseur, int $parPage): CursorPaginator
    {
        return PlatformCampaign::query()
            ->when($statut !== null, fn ($requete) => $requete->where('status', $statut?->value))
            ->orderByDesc('id')
            ->cursorPaginate($parPage, ['*'], 'cursor', $curseur);
    }

    /**
     * @return list<string>
     */
    public function sendingIds(): array
    {
        return array_values(PlatformCampaign::query()->where('status', PlatformCampaignStatus::Sending->value)->orderBy('id')->pluck('id')->all());
    }

    /**
     * @param  list<string>  $ids
     * @return array<string, array<string, int>> nombre de lignes par campagne puis par statut
     */
    public function counts(array $ids): array
    {
        $comptes = [];
        $lignes = DB::table((new PlatformCampaignDelivery)->getTable())->whereIn('campaign_id', $ids)
            ->groupBy('campaign_id', 'status')->selectRaw('campaign_id, status, count(*) as total')->get();

        foreach ($lignes as $ligne) {
            $comptes[(string) $ligne->campaign_id][(string) $ligne->status] = (int) $ligne->total;
        }

        return $comptes;
    }

    public function unsubscribed(string $campagneId): int
    {
        return PlatformCampaignDelivery::query()->where('campaign_id', $campagneId)->whereNotNull('unsubscribed_at')->count();
    }

    /**
     * @return list<string>
     */
    public function recipientEmails(PlatformCampaign $campagne): array
    {
        if ($campagne->audience !== MarketingAudience::Selected) {
            return [];
        }

        return array_values(User::query()->whereKey($campagne->recipient_user_ids)->orderBy('email')->pluck('email')->all());
    }
}
