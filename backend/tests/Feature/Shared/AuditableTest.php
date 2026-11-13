<?php

declare(strict_types=1);

use App\Modules\Identity\Models\User;
use App\Shared\Audit\AuditLog;
use App\Shared\Audit\RecordModelChange;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\Fixtures\Audit\Contract;

const ORGANISATION_CONTRAT = '01934f6e-0000-7000-8000-0000000000cc';

beforeEach(function (): void {
    Relation::morphMap(['contract_fixture' => Contract::class]);

    Schema::create('contracts_audit_test', function (Blueprint $table): void {
        $table->uuid('id')->primary();
        $table->uuid('organization_id')->nullable();
        $table->string('title');
        $table->string('phone')->nullable();
        $table->string('secret')->nullable();
        $table->text('iban')->nullable();
        $table->unsignedInteger('views')->default(0);
        $table->timestamps();
        $table->softDeletes();
    });
});

afterEach(function (): void {
    Schema::dropIfExists('contracts_audit_test');
});

function journalDe(Contract $contrat): array
{
    return AuditLog::query()->forSubject('contract_fixture', $contrat->id)->newestFirst()->get()->reverse()->values()->all();
}

it('journalise la création avec les valeurs, masque cachés, chiffrés et masqués, ignore les exclus', function (): void {
    $contrat = Contract::query()->create([
        'organization_id' => ORGANISATION_CONTRAT, 'title' => 'Bail A', 'phone' => '0601020304',
        'secret' => 's3cr3t', 'iban' => 'FR7630006000011234567890189', 'views' => 3,
    ]);

    [$entree] = journalDe($contrat);

    expect($entree->action)->toBe('contract_fixture.created')
        ->and($entree->organization_id)->toBe(ORGANISATION_CONTRAT)
        ->and($entree->changes['title'])->toBe(['old' => null, 'new' => 'Bail A'])
        ->and($entree->changes['phone'])->toBe(['old' => null, 'new' => RecordModelChange::MASQUE])
        ->and($entree->changes['secret'])->toBe(['old' => null, 'new' => RecordModelChange::MASQUE])
        ->and($entree->changes['iban'])->toBe(['old' => null, 'new' => RecordModelChange::MASQUE])
        ->and($entree->changes)->not->toHaveKeys(['id', 'views', 'created_at', 'updated_at']);

    expect(json_encode(DB::table('audit_logs')->get()))->not->toContain('0601020304')->not->toContain('FR7630006000011234567890189')->not->toContain('s3cr3t');
});

it('journalise une modification avec l\'avant et l\'après des seuls attributs modifiés', function (): void {
    $contrat = Contract::query()->create(['title' => 'Bail A']);

    $contrat->update(['title' => 'Bail B']);

    $entree = journalDe($contrat)[1];
    expect($entree->action)->toBe('contract_fixture.updated')
        ->and($entree->changes)->toBe(['title' => ['old' => 'Bail A', 'new' => 'Bail B']]);
});

it('ne journalise pas une modification qui ne touche que des attributs exclus', function (): void {
    $contrat = Contract::query()->create(['title' => 'Bail A']);

    $contrat->update(['views' => 10]);

    expect(journalDe($contrat))->toHaveCount(1);
});

it('journalise suppression et restauration', function (): void {
    $contrat = Contract::query()->create(['title' => 'Bail A']);

    $contrat->delete();
    $contrat->restore();

    expect(array_map(fn (AuditLog $e): string => $e->action, journalDe($contrat)))
        ->toBe(['contract_fixture.created', 'contract_fixture.deleted', 'contract_fixture.restored']);
});

it('attribue l\'écriture à l\'utilisateur authentifié', function (): void {
    $user = User::factory()->create();
    Auth::setUser($user);
    app('request')->setUserResolver(fn () => $user);

    $contrat = Contract::query()->create(['title' => 'Bail A']);

    expect(journalDe($contrat)[0]->actor_user_id)->toBe($user->id);
});

it('n\'écrit rien si la transaction est annulée', function (): void {
    try {
        DB::transaction(function (): void {
            Contract::query()->create(['title' => 'Bail A']);

            throw new RuntimeException('annulation');
        });
    } catch (RuntimeException) {
    }

    expect(AuditLog::query()->where('action', 'like', 'contract_fixture.%')->count())->toBe(0);
});

it('expose l\'historique depuis le modèle', function (): void {
    $contrat = Contract::query()->create(['title' => 'Bail A']);
    $contrat->update(['title' => 'Bail B']);

    expect($contrat->auditLogs()->count())->toBe(2);
});

it('journalise les comptes sans identité en clair', function (): void {
    $user = User::factory()->create(['name' => 'Jeanne Martin', 'email' => 'jeanne@exemple.fr']);
    $user->update(['name' => 'Jeanne Dupont']);

    $entrees = AuditLog::query()->forSubject('user', $user->id)->newestFirst()->get();

    expect($entrees->pluck('action')->all())->toBe(['user.updated', 'user.created'])
        ->and($entrees->first()?->changes)->toBe(['name' => ['old' => RecordModelChange::MASQUE, 'new' => RecordModelChange::MASQUE]])
        ->and(json_encode(DB::table('audit_logs')->get()))->not->toContain('jeanne@exemple.fr')->not->toContain('Jeanne');
});

it('ignore les changements de sécurité du compte, déjà audités à part', function (): void {
    $user = User::factory()->create();

    $user->forceFill(['remember_token' => 'x', 'password' => 'nouveau-mot-de-passe'])->save();

    expect(AuditLog::query()->forSubject('user', $user->id)->count())->toBe(1);
});
