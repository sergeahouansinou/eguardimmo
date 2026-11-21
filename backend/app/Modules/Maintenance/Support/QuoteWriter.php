<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Support;

use App\Modules\Maintenance\Data\PricedLineData;
use App\Modules\Maintenance\Data\QuoteInputData;
use App\Modules\Maintenance\Enums\ErrorCode;
use App\Modules\Maintenance\Enums\FileKind;
use App\Modules\Maintenance\Models\Intervention;
use App\Modules\Maintenance\Models\InterventionQuote;
use App\Modules\Maintenance\Models\InterventionQuoteLine;
use Carbon\CarbonImmutable;
use Money\Money;

final readonly class QuoteWriter
{
    public function __construct(
        private Pricing $prix,
        private Attachments $pieces,
    ) {}

    /**
     * Champs et lignes d'un devis recalculés côté serveur ; le TTC lu sur le PDF, s'il est fourni, doit être égal au calcul.
     *
     * @return array<string, mixed>
     */
    public function fill(Intervention $intervention, QuoteInputData $donnees, ?InterventionQuote $courant): array
    {
        $calcul = $this->prix->quote($donnees->lines, CarbonImmutable::parse($donnees->issuedOn));
        $brut = $calcul->net + $calcul->tax;

        if ($donnees->declaredGross !== null && $donnees->declaredGross !== $brut) {
            throw ErrorCode::QuoteTotalMismatch->problem();
        }

        $fichier = $this->pieces->resolve($donnees->fileId, $intervention->id, FileKind::Quote);
        $utilise = InterventionQuote::query()->where('stored_file_id', $fichier->stored_file_id)->when($courant !== null, fn ($requete) => $requete->whereKeyNot($courant?->id))->exists();

        if ($utilise) {
            throw ErrorCode::FileInvalid->problem('Ce PDF est déjà rattaché à un devis.');
        }

        $monnaie = Currencies::of($intervention->currency);

        return [
            'fields' => [
                'reference' => $donnees->reference,
                'kind' => $donnees->kind,
                'issued_on' => $donnees->issuedOn,
                'valid_until' => $donnees->validUntil,
                'proposed_on' => $donnees->proposedOn,
                'message' => $donnees->message,
                'stored_file_id' => $fichier->stored_file_id,
                'total_net' => new Money($calcul->net, $monnaie),
                'total_tax' => new Money($calcul->tax, $monnaie),
                'total_gross' => new Money($brut, $monnaie),
                'currency' => $intervention->currency,
            ],
            'lines' => $calcul->lines,
        ];
    }

    /**
     * @param  list<PricedLineData>  $lignes
     */
    public function writeLines(InterventionQuote $devis, array $lignes): void
    {
        InterventionQuoteLine::query()->where('quote_id', $devis->id)->delete();

        foreach ($lignes as $ligne) {
            InterventionQuoteLine::query()->create([
                'quote_id' => $devis->id,
                'position' => $ligne->position,
                'label' => $ligne->label,
                'quantity_milli' => $ligne->quantityMilli,
                'unit' => $ligne->unit,
                'unit_price' => $ligne->unitPrice,
                'net_amount' => $ligne->net,
                'tax_category' => $ligne->category,
                'tax_rate_pcm' => $ligne->ratePcm,
            ]);
        }
    }
}
