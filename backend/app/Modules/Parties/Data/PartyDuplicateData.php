<?php

declare(strict_types=1);

namespace App\Modules\Parties\Data;

final readonly class PartyDuplicateData
{
    /**
     * @param  list<string>  $reasons  parmi email, phone, identifier, name
     */
    public function __construct(
        public string $id,
        public string $displayName,
        public array $reasons,
    ) {}

    /**
     * @return array{id: string, display_name: string, reasons: list<string>}
     */
    public function toArray(): array
    {
        return ['id' => $this->id, 'display_name' => $this->displayName, 'reasons' => $this->reasons];
    }
}
