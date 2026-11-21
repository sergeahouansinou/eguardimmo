<?php

declare(strict_types=1);

namespace App\Modules\Tax\Data;

final readonly class LineResultData
{
    public const string PROPOSED = 'proposed';

    public const string CONFLICT = 'conflict';

    /**
     * @param  string  $status  `computed`, `proposed` (à valider), `to_complete`, `conflict` ou `total`
     * @param  int  $exact  unités mineures, avant arrondi
     * @param  int  $rounded  unités mineures, arrondi à l'unité majeure (multiple de `minorPerMajor`)
     * @param  list<array{kind: string, ref: ?string, amount: int}>  $sources
     */
    public function __construct(
        public string $code,
        public string $label,
        public string $status,
        public int $exact,
        public int $rounded,
        public array $sources = [],
        public bool $sourcesTruncated = false,
    ) {}

    /**
     * @return array{code: string, label: string, status: string, exact: int, rounded: int, sources: list<array{kind: string, ref: ?string, amount: int}>, sources_truncated: bool}
     */
    public function toArray(): array
    {
        return ['code' => $this->code, 'label' => $this->label, 'status' => $this->status, 'exact' => $this->exact, 'rounded' => $this->rounded, 'sources' => $this->sources, 'sources_truncated' => $this->sourcesTruncated];
    }
}
