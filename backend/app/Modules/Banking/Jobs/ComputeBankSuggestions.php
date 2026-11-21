<?php

declare(strict_types=1);

namespace App\Modules\Banking\Jobs;

use App\Modules\Banking\Actions\ComputeSuggestions;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;

/**
 * Propositions d'un relevé, calculées après l'import. Idempotent : refaire le calcul remplace les propositions ; doublé par `banking:suggest`.
 * Ne porte que des identifiants : jamais de libellé dans la file.
 */
final class ComputeBankSuggestions implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;

    public int $tries = 3;

    public function __construct(public readonly string $organizationId, public readonly string $statementId) {}

    public function handle(CurrentOrganization $organisation, ComputeSuggestions $calcul): void
    {
        $organisation->run($this->organizationId, fn (): int => $calcul->handle($this->statementId));
    }
}
