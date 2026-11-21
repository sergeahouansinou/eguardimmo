<?php

declare(strict_types=1);

namespace App\Modules\Operations\Data;

use App\Modules\Operations\Enums\ProbeState;

final readonly class ProbeResult
{
    /**
     * @param  array<string, mixed>  $details  valeurs scalaires ou listes de scalaires : jamais de version, d'hôte, de chemin ni de secret
     */
    public function __construct(public ProbeState $state, public array $details = []) {}

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return ['state' => $this->state->value, ...$this->details];
    }
}
