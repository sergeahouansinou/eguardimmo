<?php

declare(strict_types=1);

use App\Modules\Charges\Support\ShareCalculator;
use Money\Currency;
use Money\Money;

it('XOF : le calcul reste en francs entiers, arrondi vers le bas', function (): void {
    $calcul = new ShareCalculator;
    $montant = new Money(100000, new Currency('XOF'));

    $part = $calcul->share($montant, 1, 3, 1);

    expect($part->getAmount())->toBe('33333')->and($part->getCurrency()->getCode())->toBe('XOF');
});

it('la répartition ne dépasse jamais le montant : le reste revient au propriétaire', function (): void {
    $calcul = new ShareCalculator;
    $partage = $calcul->split(new Money(10000, new Currency('EUR')), 7, 304, ['a' => 1 * 304, 'b' => 2 * 304, 'c' => 4 * 304]);

    expect(array_map(fn (Money $m): string => $m->getAmount(), $partage->shares))->toBe(['a' => '1428', 'b' => '2857', 'c' => '5714'])
        ->and($partage->owner->getAmount())->toBe('1');
});

it('provision suggérée : un douzième arrondi au demi supérieur', function (): void {
    $calcul = new ShareCalculator;

    expect($calcul->suggestedMonthly(new Money(5120, new Currency('EUR')))->getAmount())->toBe('427')
        ->and($calcul->suggestedMonthly(new Money(5118, new Currency('EUR')))->getAmount())->toBe('427')
        ->and($calcul->suggestedMonthly(new Money(5117, new Currency('EUR')))->getAmount())->toBe('426');
});

it('douze mensualités : la dernière porte l\'écart d\'arrondi et la somme est exacte', function (): void {
    $calcul = new ShareCalculator;
    $lignes = $calcul->twelfths(new Money(1003, new Currency('EUR')));
    $somme = array_reduce($lignes, fn (int $c, Money $m): int => $c + (int) $m->getAmount(), 0);

    expect($lignes)->toHaveCount(12)->and($lignes[0]->getAmount())->toBe('83')->and($lignes[11]->getAmount())->toBe('90')->and($somme)->toBe(1003);
});

it('refuse un dénominateur ou une durée nuls', function (): void {
    $calcul = new ShareCalculator;

    expect(fn () => $calcul->share(new Money(100, new Currency('EUR')), 1, 0, 365))->toThrow(InvalidArgumentException::class)
        ->and(fn () => $calcul->share(new Money(100, new Currency('EUR')), 1, 1, 0))->toThrow(InvalidArgumentException::class);
});
