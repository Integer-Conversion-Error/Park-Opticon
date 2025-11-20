package main

import (
	"fmt"
	"golang.org/x/crypto/bcrypt"
	"os"
)

func main() {
	password := "admin123"
	if len(os.Args) > 1 {
		password = os.Args[1]
	}
	
	hash, err := bcrypt.GenerateFromPassword([]byte(password), 10)
	if err != nil {
		fmt.Println("Error:", err)
		os.Exit(1)
	}
	
	fmt.Println(string(hash))
}
