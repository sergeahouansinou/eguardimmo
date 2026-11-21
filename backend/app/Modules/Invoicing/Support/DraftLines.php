<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Support;

use App\Modules\Accounting\PublicApi\LedgerReader;
use App\Modules\Catalog\Enums\InvoiceItemSemantic;
use App\Modules\Catalog\Enums\VocabularyKey;
use App\Modules\Catalog\PublicApi\TermDirectory;
use App\Modules\Invoicing\Data\NewLineData;
use App\Modules\Invoicing\Enums\ErrorCode;
use App\Modules\Invoicing\Jurisdictions\InvoiceTaxRules;

/**
 * Nature des lignes lue dans le référentiel `invoice_item` de l'organisation : le sens système fixe le compte de produit.
 */
final readonly class DraftLines
{
    public function __construct(
        private TermDirectory $termes,
        private LedgerReader $livre,
    ) {}

    /**
     * @param  list<NewLineData>  $lignes
     * @return list<PricingLine>
     */
    public function build(array $lignes, InvoiceTaxRules $regles, ReferenceContext $references, bool $generatedByServer = false): array
    {
        $termes = $this->termes->findMany(array_map(fn (NewLineData $l): string => $l->itemTermId, $lignes), VocabularyKey::InvoiceItem);
        $resultat = [];

        foreach ($lignes as $ligne) {
            $terme = $termes[$ligne->itemTermId];

            if ($terme->isArchived || $terme->isHidden) {
                throw ErrorCode::LinesInvalid->problem();
            }

            $sens = InvoiceItemSemantic::tryFrom((string) $terme->semanticKey) ?? throw ErrorCode::LinesInvalid->problem();
            $this->assertManuallyEntered($sens, $generatedByServer);
            $regles->assertItemAllowed($sens, $references->recipientIsMandant);
            $resultat[] = new PricingLine($terme->id, $sens, $ligne->description, $ligne->quantityMilli, $ligne->unitPrice, $ligne->taxCategory, $ligne->taxRateKey);
        }

        return $resultat;
    }

    /**
     * Une fois les fonds des mandants activés, les honoraires de gestion ne viennent plus que du relevé calculé par le serveur.
     */
    public function assertManuallyEntered(InvoiceItemSemantic $sens, bool $generatedByServer): void
    {
        if ($sens === InvoiceItemSemantic::FeeManagement && ! $generatedByServer && $this->livre->ownerFundsCutoverAt() !== null) {
            throw ErrorCode::FeeComputedByServer->problem();
        }
    }
}
