<?php

declare(strict_types=1);

namespace App\Modules\Leases\Support;

use App\Modules\Leases\Data\NoticeReason;
use App\Modules\Leases\Enums\ErrorCode;
use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Models\LeaseNoticeRequest;
use App\Modules\Leases\Models\LeaseUnit;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\Parties\PublicApi\PartyDirectory;
use App\Modules\Properties\PublicApi\UnitDirectory;
use App\Shared\Pdf\GotenbergRenderer;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\View;

/**
 * Lettre de congé : instantané figé à l'émission, puis PDF rendu par Gotenberg, jamais produit en PHP.
 */
final readonly class NoticeLetters
{
    public const string TEMPLATE_VERSION = 'notice-letter-v1';

    public function __construct(
        private PartyDirectory $parties,
        private UnitDirectory $lots,
        private OrganizationDirectory $organisations,
        private GotenbergRenderer $gotenberg,
    ) {}

    /**
     * Ne contient que ce que la lettre montre : le motif y figure en libellé, jamais en clé interne. L'adresse de réexpédition n'y figure pas :
     * elle reste chiffrée dans la demande, pour pouvoir être effacée avec la fiche sans toucher à la pièce probante.
     *
     * @return array<string, mixed>
     */
    public function snapshot(LeaseNoticeRequest $demande, Lease $bail, NoticeReason $motif, CarbonImmutable $jour): array
    {
        $principal = LeaseUnit::query()->where('lease_id', $bail->id)->where('is_main', true)->orderByDesc('valid_from')->first();
        $adresse = $principal === null ? null : $this->lots->find($principal->unit_id)->address;
        $lignes = $adresse === null ? [] : array_filter([$adresse['line1'], $adresse['line2'] ?? null, trim($adresse['postal_code'].' '.$adresse['city'])]);

        return [
            'template_version' => self::TEMPLATE_VERSION,
            'tenant_name' => $this->parties->find($demande->party_id)->displayName,
            'agency_name' => $this->organisations->names([$bail->organization_id])[$bail->organization_id] ?? '',
            'housing_address' => implode(', ', $lignes),
            'lease_reference' => $bail->reference,
            'reason_label' => $motif->label,
            'proof_attached' => $demande->proof_file_id !== null,
            'requested_departure_on' => $demande->requested_departure_on->format('d/m/Y'),
            'letter_date' => $jour->format('d/m/Y'),
            'consent_version' => $demande->consent_version,
        ];
    }

    /**
     * @param  array<string, mixed>  $snapshot
     */
    public function pdf(array $snapshot): string
    {
        $html = View::make('leases::notice-letter', ['s' => $snapshot])->render();

        return $this->gotenberg->render($html, config('leases.gotenberg.url'), config('leases.gotenberg.timeout'), 'LEASES_GOTENBERG_URL')
            ?? throw ErrorCode::NoticeLetterUnavailable->problem();
    }
}
