<?php

declare(strict_types=1);

use App\Shared\Money\MoneyCast;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Money\Currency;
use Money\Money;

final class LigneMonetaireDeTest extends Model
{
    protected $table = 'lignes_monetaires_test';

    protected $guarded = [];

    public $timestamps = false;

    protected function casts(): array
    {
        return ['montant' => MoneyCast::class.':devise'];
    }
}

beforeEach(function (): void {
    Schema::create('lignes_monetaires_test', function (Blueprint $table): void {
        $table->id();
        $table->bigInteger('montant')->nullable();
        $table->char('devise', 3)->nullable();
    });
});

it('persiste le montant en unités mineures et la devise', function (): void {
    $ligne = LigneMonetaireDeTest::query()->create(['montant' => Money::XOF(150000)]);

    $brut = DB::table('lignes_monetaires_test')->find($ligne->id);

    expect((int) $brut->montant)->toBe(150000)
        ->and($brut->devise)->toBe('XOF');
});

it('relit un Money identique, devise comprise', function (): void {
    $ligne = LigneMonetaireDeTest::query()->create(['montant' => Money::EUR(123456)]);

    $relu = LigneMonetaireDeTest::query()->findOrFail($ligne->id)->montant;

    expect($relu)->toBeInstanceOf(Money::class)
        ->and($relu->equals(new Money(123456, new Currency('EUR'))))->toBeTrue();
});

it('accepte null', function (): void {
    $ligne = LigneMonetaireDeTest::query()->create(['montant' => null]);

    expect(LigneMonetaireDeTest::query()->findOrFail($ligne->id)->montant)->toBeNull();
});

it('refuse une valeur qui n\'est pas un Money', function (): void {
    LigneMonetaireDeTest::query()->create(['montant' => 1500]);
})->throws(InvalidArgumentException::class);

it('refuse de relire un montant sans devise', function (): void {
    DB::table('lignes_monetaires_test')->insert(['montant' => 100, 'devise' => null]);

    LigneMonetaireDeTest::query()->firstOrFail()->montant;
})->throws(LogicException::class);

it('refuse une devise inconnue en écriture', function (): void {
    LigneMonetaireDeTest::query()->create(['montant' => new Money(100, new Currency('ZZZ'))]);
})->throws(LogicException::class);

it('refuse une devise inconnue en lecture', function (): void {
    DB::table('lignes_monetaires_test')->insert(['montant' => 100, 'devise' => 'ZZZ']);

    LigneMonetaireDeTest::query()->firstOrFail()->montant;
})->throws(LogicException::class);

it('reflète un changement de devise après lecture', function (): void {
    $ligne = LigneMonetaireDeTest::query()->create(['montant' => Money::XOF(5000)]);
    $ligne->montant;

    $ligne->devise = 'EUR';

    expect($ligne->montant->getCurrency()->getCode())->toBe('EUR');
});

it('conserve les montants négatifs et les grands montants', function (): void {
    $negatif = LigneMonetaireDeTest::query()->create(['montant' => Money::XOF(-2500)]);
    $grand = LigneMonetaireDeTest::query()->create(['montant' => Money::XOF(PHP_INT_MAX)]);

    expect(LigneMonetaireDeTest::query()->findOrFail($negatif->id)->montant->getAmount())->toBe('-2500')
        ->and(LigneMonetaireDeTest::query()->findOrFail($grand->id)->montant->getAmount())->toBe((string) PHP_INT_MAX);
});
