<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Support;

use App\Modules\Invoicing\PublicApi\InvoiceLedger;
use App\Modules\Recovery\Enums\ItemType;
use App\Modules\Recovery\Models\RecoveryCaseItem;
use App\Modules\Rent\PublicApi\RentLedger;

/**
 * Pièces déjà émises des créances d'un dossier, lues chez leur propriétaire : avis d'échéance de Rent, factures d'Invoicing.
 */
final readonly class BundleDocuments
{
    public function __construct(
        private RentLedger $loyers,
        private InvoiceLedger $factures,
    ) {}

    /**
     * Une échéance sans avis émis n'apporte aucune pièce ; une facture lève invoice_not_found si elle n'est plus émise.
     *
     * @param  list<RecoveryCaseItem>  $creances
     * @return array{files: list<string>, pieces: list<array<string, mixed>>}
     */
    public function of(array $creances): array
    {
        $idsAvis = array_values(array_map(fn (RecoveryCaseItem $c): string => $c->item_id, array_filter($creances, fn (RecoveryCaseItem $c): bool => $c->item_type === ItemType::Installment)));
        $avis = $idsAvis === [] ? [] : $this->loyers->noticesOf($idsAvis);
        $fichiers = [];
        $pieces = [];

        foreach ($creances as $creance) {
            if ($creance->item_type === ItemType::Invoice) {
                $facture = $this->factures->find($creance->item_id);
                $fichiers[] = $facture->storedFileId;
                $pieces[] = ['kind' => 'invoice', 'label' => 'Facture', 'number' => $facture->number, 'file_name' => "facture-{$facture->number}.pdf", 'sha256' => $facture->fingerprint, 'item_id' => $creance->item_id];
            } elseif (isset($avis[$creance->item_id])) {
                $notice = $avis[$creance->item_id];
                $fichiers[] = $notice->storedFileId;
                $pieces[] = ['kind' => 'rent_notice', 'label' => 'Avis d\'échéance', 'number' => $notice->number, 'file_name' => "avis-echeance-{$notice->number}.pdf", 'sha256' => $notice->fingerprint, 'item_id' => $creance->item_id];
            }
        }

        return ['files' => $fichiers, 'pieces' => $pieces];
    }
}
