<?php

declare(strict_types=1);

namespace App\Shared\Http;

use RuntimeException;
use Throwable;

final class ApiProblem extends RuntimeException
{
    /**
     * @param  array<string, string>  $headers
     */
    public function __construct(
        public readonly string $problemCode,
        public readonly int $status,
        public readonly string $title,
        string $detail,
        public readonly array $headers = [],
        ?Throwable $previous = null,
    ) {
        parent::__construct($detail, 0, $previous);
    }
}
