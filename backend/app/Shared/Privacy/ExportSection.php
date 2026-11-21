<?php

declare(strict_types=1);

namespace App\Shared\Privacy;

/**
 * Part d'un export de données personnelles fournie par un module : valeurs scalaires seulement, jamais de secret.
 */
final readonly class ExportSection
{
    /**
     * @param  array<string, mixed>  $data
     */
    public function __construct(public string $key, public array $data) {}
}
