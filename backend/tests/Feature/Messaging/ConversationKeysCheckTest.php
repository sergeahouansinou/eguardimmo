<?php

declare(strict_types=1);

use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

function expressionKindKeys(): string
{
    $source = (string) file_get_contents(base_path('app/Modules/Messaging/Database/Migrations/2026_11_19_500000_extend_conversations_for_external_threads.php'));
    preg_match("/Checks::add\\('conversations', 'kind_keys', \"(.+)\"\\);/", $source, $trouve);

    return $trouve[1] ?? throw new RuntimeException('Contrainte kind_keys introuvable dans la migration.');
}

function insererCle(string $kind, ?string $party, ?string $lease, ?string $mandate): bool
{
    try {
        DB::table('cle_check')->insert(['kind' => $kind, 'party_id' => $party, 'lease_id' => $lease, 'mandate_id' => $mandate]);

        return true;
    } catch (QueryException) {
        return false;
    }
}

beforeEach(function (): void {
    DB::statement('CREATE TABLE cle_check (kind TEXT, party_id TEXT, lease_id TEXT, mandate_id TEXT, CHECK ('.expressionKindKeys().'))');
});

it('n\'accepte que les clés propres à chaque sorte de fil', function (string $kind, ?string $party, ?string $lease, ?string $mandate, bool $attendu): void {
    expect(insererCle($kind, $party, $lease, $mandate))->toBe($attendu);
})->with([
    'locataire : fiche et bail' => ['tenant', 'p', 'l', null, true],
    'locataire avec un mandat' => ['tenant', 'p', 'l', 'm', false],
    'locataire sans bail' => ['tenant', 'p', null, null, false],
    'mandant : fiche seule' => ['owner', 'p', null, null, true],
    'mandant avec un mandat' => ['owner', 'p', null, 'm', true],
    'mandant avec un bail' => ['owner', 'p', 'l', null, false],
    'mandant avec bail et mandat' => ['owner', 'p', 'l', 'm', false],
    'mandant sans fiche' => ['owner', null, null, 'm', false],
    'interne : aucune clé' => ['internal', null, null, null, true],
    'interne avec un bail' => ['internal', null, 'l', null, false],
    'interne avec une fiche' => ['internal', 'p', null, null, false],
]);
