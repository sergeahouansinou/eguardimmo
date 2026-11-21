<?php

declare(strict_types=1);

namespace App\Modules\Tax\Data;

use LogicException;

final readonly class FormDefinition
{
    /**
     * Formulaire d'une année de revenus, tel qu'une juridiction le décrit : tout chiffre fiscal vient d'ici, jamais du code appelant.
     *
     * @param  list<FormLineData>  $lines  dans l'ordre du formulaire
     * @param  array<string, string>  $categoryLines  sens de catégorie de dépense => code de ligne
     * @param  array<int|string, array{plus: list<string>, minus: list<string>}>  $totals  code de total => lignes ajoutées et retranchées, dans l'ordre de calcul
     * @param  list<string>  $mentions
     */
    public function __construct(
        public string $jurisdiction,
        public int $incomeYear,
        public string $version,
        public string $templateVersion,
        public string $currency,
        public array $lines,
        public array $categoryLines,
        public array $totals,
        public int $minorPerMajor,
        public int $flatFeePerPremises,
        public int $microThreshold,
        public int $microAllowanceBp,
        public int $deficitCeiling,
        public string $warning,
        public array $mentions,
    ) {}

    /**
     * Même formulaire dont ces lignes passent « à compléter » : l'agence ne connaît pas les prêts de son mandant.
     *
     * @param  list<string>  $codes
     */
    public function withToComplete(array $codes): self
    {
        return new self(
            $this->jurisdiction, $this->incomeYear, $this->version, $this->templateVersion, $this->currency,
            array_map(fn (FormLineData $l): FormLineData => in_array($l->code, $codes, true) ? new FormLineData($l->code, $l->label, FormLineData::TO_COMPLETE) : $l, $this->lines),
            $this->categoryLines, $this->totals, $this->minorPerMajor, $this->flatFeePerPremises, $this->microThreshold, $this->microAllowanceBp, $this->deficitCeiling, $this->warning, $this->mentions,
        );
    }

    public function line(string $code): FormLineData
    {
        foreach ($this->lines as $ligne) {
            if ($ligne->code === $code) {
                return $ligne;
            }
        }

        throw new LogicException("Ligne {$code} absente du formulaire {$this->version}.");
    }

    public function lineForCategory(string $semanticKey): ?string
    {
        return $this->categoryLines[$semanticKey] ?? null;
    }
}
