<?php

declare(strict_types=1);

use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

function contraintesAcces(): array
{
    $source = (string) file_get_contents(base_path('app/Modules/Messaging/Database/Migrations/2026_11_19_630000_check_support_access_grants_consistency.php'));
    preg_match_all('/Checks::add\(\'support_access_grants\', \'([a-z_]+)\', ([\'"])(.+)\2\);/', $source, $trouvees, PREG_SET_ORDER);

    return array_column($trouvees, 3, 1) ?: throw new RuntimeException('Contraintes introuvables dans la migration.');
}

function insererAcces(array $ligne): bool
{
    try {
        DB::table('acces_check')->insert([...['kind' => 'consent', 'status' => 'active', 'organization_id' => 'o', 'scopes' => '["team"]', 'emergency_basis' => null], ...$ligne]);

        return true;
    } catch (QueryException) {
        return false;
    }
}

beforeEach(function (): void {
    $contraintes = array_map(fn (string $expression): string => str_replace('JSON_LENGTH(', 'json_array_length(', $expression), contraintesAcces());
    expect(array_keys($contraintes))->toBe(['scopes_present', 'live_organization', 'emergency_basis_kind']);
    DB::statement('CREATE TABLE acces_check (kind TEXT, status TEXT, organization_id TEXT, scopes TEXT, emergency_basis TEXT, '.implode(', ', array_map(fn (string $e): string => "CHECK ({$e})", $contraintes)).')');
});

it('accepte un accès consenti ou d\'urgence cohérent', function (array $ligne): void {
    expect(insererAcces($ligne))->toBeTrue();
})->with([
    'consentement actif' => [[]],
    'consentement demandé' => [['status' => 'requested']],
    'urgence active avec fondement' => [['kind' => 'emergency', 'emergency_basis' => 'security_incident']],
    'ancien accès neutralisé' => [['organization_id' => null, 'scopes' => '[]', 'status' => 'expired']],
    'accès refusé sans organisation' => [['organization_id' => null, 'status' => 'refused', 'scopes' => '["team"]']],
]);

it('refuse un accès incohérent', function (array $ligne): void {
    expect(insererAcces($ligne))->toBeFalse();
})->with([
    'périmètre vide avec organisation' => [['scopes' => '[]']],
    'périmètre absent avec organisation' => [['scopes' => null]],
    'accès actif sans organisation' => [['organization_id' => null]],
    'demande sans organisation' => [['organization_id' => null, 'status' => 'requested']],
    'urgence sans fondement' => [['kind' => 'emergency']],
    'consentement avec un fondement d\'urgence' => [['emergency_basis' => 'legal_requisition']],
]);
