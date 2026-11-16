<?php

declare(strict_types=1);

use App\Shared\Audit\AuditLog;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\Route;

const CLE_RELAIS = 'cle-de-relais-de-test-0123456789-abcdef';

beforeEach(function (): void {
    config(['identity.console_relay_key' => CLE_RELAIS]);
    Route::middleware('api')->post('/api/v1/sonde-ip-audit', function (RecordAudit $audit): array {
        $audit->handle('sonde.ip');

        return [];
    });
});

function ipAuditee(): ?string
{
    return AuditLog::query()->where('action', 'sonde.ip')->sole()->ip;
}

it('enregistre l\'IP relayée par la console avec la bonne clé', function (): void {
    $this->postJson('/api/v1/sonde-ip-audit', [], ['X-Console-Relay-Key' => CLE_RELAIS, 'X-Console-Client-Ip' => '203.0.113.7'])->assertOk();

    expect(ipAuditee())->toBe('203.0.113.7');
});

it('ignore l\'IP annoncée sans clé de relais', function (): void {
    $this->postJson('/api/v1/sonde-ip-audit', [], ['X-Console-Client-Ip' => '203.0.113.7'])->assertOk();

    expect(ipAuditee())->toBe('127.0.0.1');
});

it('ignore l\'IP annoncée avec une mauvaise clé de relais', function (): void {
    $this->postJson('/api/v1/sonde-ip-audit', [], ['X-Console-Relay-Key' => 'autre-cle-de-relais-0123456789-abcdef', 'X-Console-Client-Ip' => '203.0.113.7'])->assertOk();

    expect(ipAuditee())->toBe('127.0.0.1');
});

it('ignore une IP relayée invalide', function (): void {
    $this->postJson('/api/v1/sonde-ip-audit', [], ['X-Console-Relay-Key' => CLE_RELAIS, 'X-Console-Client-Ip' => 'pas-une-ip'])->assertOk();

    expect(ipAuditee())->toBe('127.0.0.1');
});

it('refuse une clé de relais de moins de 32 caractères', function (): void {
    config(['identity.console_relay_key' => 'cle-courte']);

    $this->postJson('/api/v1/sonde-ip-audit', [], ['X-Console-Relay-Key' => 'cle-courte', 'X-Console-Client-Ip' => '203.0.113.7'])->assertOk();

    expect(ipAuditee())->toBe('127.0.0.1');
});
